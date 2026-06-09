const express = require("express");
const app = express();

const PORT = 3000;

// get image name from environment variable
const IMAGE_NAME = process.env.IMAGE_NAME || "No Image Defined";

// serve static files
app.use(express.static("public"));

// API to send image name
app.get("/api/image", (req, res) => {
  res.json({
    image: IMAGE_NAME
  });
});

app.listen(PORT, () => {
  console.log(`App running on http://localhost:${PORT}`);
});