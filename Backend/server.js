import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors());

const BASE_API = "https://v6.db.transport.rest";

app.get("/api/*path", async (req, res) => {
  try {
    const endpoint = Array.isArray(req.params.path)
      ? req.params.path.join("/")
      : req.params.path;

    const query = req.url.split("?")[1] || "";

    const url = `${BASE_API}/${endpoint}${query ? `?${query}` : ""}`;

    console.log("Proxy request:", url);

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Proxy request failed" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
