const express = require("express");
const axios = require("axios");

const router = express.Router();
const GEMINI_MODEL = "gemini-3.6-flash";

router.post("/stream", async (req, res) => {
  const prompt =
    typeof req.body === "string" ? req.body : req.body?.prompt;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "AI service is not configured" });
  }

  try {
    const upstream = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt.trim() }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1024,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        responseType: "stream",
      },
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    upstream.data.pipe(res);
    upstream.data.on("error", (error) => {
      console.error("AI stream error:", error.message);
      res.end();
    });
  } catch (error) {
    console.error("AI request error:", error.message);

    if (!res.headersSent) {
      res.status(502).json({ error: "AI service request failed" });
    }
  }
});

module.exports = router;
