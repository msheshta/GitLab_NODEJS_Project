# GitLab CI/CD Node.js Application on AWS EKS

A simple Node.js application demonstrating an automated CI/CD workflow with GitLab, Docker, GitLab Container Registry, Kubernetes, and the GitLab Kubernetes Agent.

The application serves a static web page and exposes an API endpoint that returns the Docker image name supplied through the `IMAGE_NAME` environment variable. GitLab CI/CD builds and pushes a versioned container image, then applies the Kubernetes Deployment and Service manifests to the connected cluster.

## Project Overview

The project demonstrates how to:

- Build and run a Node.js application with Express.
- Package the application as a Docker image.
- Automate dependency installation, image building, registry publishing, and deployment through GitLab CI/CD.
- Tag container images with the GitLab pipeline ID.
- Deploy the application to Kubernetes using `kubectl` and the GitLab Kubernetes Agent.
- Expose the application through an AWS internet-facing Network Load Balancer (NLB).

## Architecture

```text
Developer
   |
   | Push code
   v
GitLab Repository
   |
   v
GitLab CI/CD Pipeline
   |
   +--> Install dependencies (npm)
   |
   +--> Build Docker image
   |
   +--> Push image to GitLab Container Registry
   |
   v
GitLab Kubernetes Agent
   |
   v
AWS EKS Cluster
   |
   +--> Kubernetes Deployment (2 replicas)
   |
   +--> Kubernetes Service (LoadBalancer)
             |
             v
       AWS Network Load Balancer
             |
             v
       Node.js Application
```

## Technologies Used

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Web application framework |
| Docker | Containerization |
| GitLab CI/CD | Pipeline automation |
| GitLab Container Registry | Docker image storage |
| Kubernetes | Container orchestration |
| AWS EKS | Managed Kubernetes environment |
| GitLab Kubernetes Agent | Secure connection between GitLab and Kubernetes |
| kubectl | Kubernetes deployment management |

## Repository Structure

```text
.
├── .gitlab/
│   └── agents/
│       └── eks-agent/
│           └── config.yaml
├── public/
│   └── index.html
├── .gitlab-ci.yml
├── .gitignore
├── Dockerfile
├── deployment.yaml
├── package-lock.json
├── package.json
├── server.js
└── service.yaml
```

## Application

The Express application listens on port `3000` and serves the static frontend from the `public/` directory.

### API Endpoint

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/image` | Returns the image name configured through `IMAGE_NAME` |

Example response:

```json
{
  "image": "your-container-image"
}
```

If `IMAGE_NAME` is not set, the application returns `No Image Defined`.

## CI/CD Pipeline

The pipeline is configured in `.gitlab-ci.yml`.

### Pipeline stages

1. **Install** — Uses the `node:22-alpine` image and runs `npm install`.
2. **Build and Push** — Builds the Docker image with Docker-in-Docker and pushes it to GitLab Container Registry.
3. **Deploy** — Uses the Bitnami kubectl image, replaces `IMAGE_PLACEHOLDER` in `deployment.yaml` with the generated image name, selects the configured Kubernetes context, and applies the Deployment and Service manifests.

### Image versioning

The pipeline defines the image name as:

```bash
registry.gitlab.com/$CI_PROJECT_PATH:$CI_PIPELINE_IID
```

This gives each pipeline run a unique image tag based on `CI_PIPELINE_IID`.

### Registry authentication

The active GitLab Registry job uses GitLab's predefined variables:

- `CI_REGISTRY_USER`
- `CI_REGISTRY_PASSWORD`

The deployment also references an image pull secret named `gitlab-registry-secret`. This Kubernetes Secret must exist in the target namespace and contain valid credentials for pulling the private image.

## Kubernetes Configuration

### Deployment

`deployment.yaml` defines:

- Deployment name: `nodejs-app`
- Replicas: `2`
- Container port: `3000`
- Image pull secret: `gitlab-registry-secret`
- Image: injected by the CI/CD pipeline through `IMAGE_PLACEHOLDER`

### Service

`service.yaml` defines:

- Service name: `nodejs-service`
- Type: `LoadBalancer`
- Service port: `80`
- Target port: `3000`
- AWS load balancer scheme: `internet-facing`
- AWS load balancer type: `nlb`

The Service requests an internet-facing AWS Network Load Balancer. Actual provisioning depends on the AWS Load Balancer Controller / cluster configuration and the required AWS permissions and networking setup.

## Prerequisites

Before using the deployment pipeline, prepare:

- A GitLab project containing this repository.
- A GitLab Runner configured to run the pipeline.
- Docker-in-Docker support enabled for the runner.
- GitLab Container Registry enabled for the project.
- An AWS EKS cluster with a working Kubernetes context.
- GitLab Kubernetes Agent installed and connected to the cluster.
- The agent project access configured as required by the GitLab Agent setup.
- A Kubernetes image pull Secret named `gitlab-registry-secret` in the deployment namespace.
- AWS load-balancer integration configured if you want the `LoadBalancer` Service to provision an NLB.

## Configuration

### 1. Configure the GitLab Kubernetes Agent

The agent configuration is located at:

```text
.gitlab/agents/eks-agent/config.yaml
```

The current configuration grants CI access to the project identified in that file. Make sure the configured project ID matches the GitLab project you intend to deploy from.

### 2. Configure the Kubernetes context

The deploy job uses the `KUBE_CONTEXT` CI/CD variable:

```bash
kubectl config use-context "$KUBE_CONTEXT"
```

Set `KUBE_CONTEXT` in the GitLab project's CI/CD variables to the correct GitLab Agent context path.

### 3. Configure the image pull Secret

Create `gitlab-registry-secret` in the target Kubernetes namespace with credentials that can pull images from the GitLab Container Registry.

Do not commit registry passwords, access tokens, or other secrets to the repository.

## Run Locally

Requirements: Node.js 22 or a compatible Node.js release, and npm.

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Test the API:

```bash
curl http://localhost:3000/api/image
```

To provide an image name locally:

```bash
IMAGE_NAME="local-nodejs-image" npm start
```

## Build and Run with Docker

Build the image:

```bash
docker build -t gitlab-node-app:local .
```

Run the container:

```bash
docker run --rm -p 3000:3000 \
  -e IMAGE_NAME="gitlab-node-app:local" \
  gitlab-node-app:local
```

Open `http://localhost:3000`.

## Deploy Manually to Kubernetes

The manifests contain an `IMAGE_PLACEHOLDER` value. Replace it with an image that is available to your cluster, then apply the manifests:

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

Check the deployment and Service:

```bash
kubectl get deployments
kubectl get pods
kubectl get services
```

For a private registry image, ensure the referenced image pull Secret exists before deploying.

## Notes

- The current Kubernetes Deployment requests two replicas.
- The application listens on port `3000`; the Kubernetes Service exposes port `80`.
- The pipeline's active image publishing job pushes to GitLab Container Registry.
- `.build_push_job` is a hidden GitLab CI job template in the current pipeline configuration. It contains Docker Hub login/push commands but is not executed unless another job extends it.
- The AWS LoadBalancer annotations request an internet-facing NLB; successful provisioning is dependent on the cluster's AWS load-balancer integration and permissions.
- This README describes the configuration present in the repository. Environment-specific values such as the EKS cluster, GitLab Runner, Agent context, registry credentials, and AWS networking must be configured in your own environment.

## Author

**Mohamed Elsheshtawy Rakha**

## Repository

[GitHub - GitLab_NODEJS_Project](https://github.com/msheshta/GitLab_NODEJS_Project)
