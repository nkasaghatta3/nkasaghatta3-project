const express = require("express");
const axios = require("axios");

const router = express.Router();
const GEMINI_MODEL = "gemini-3.6-flash";

function readErrorStream(stream) {
  return new Promise((resolve) => {
    let chunks = "";

    stream.on("data", (chunk) => {
      chunks += chunk.toString();
    });

    stream.on("end", () => resolve(chunks));
    stream.on("error", () => resolve("(could not read error stream)"));
  });
}

router.post("/stream", async (req, res) => {
  const prompt =
    typeof req.body === "string" ? req.body : req.body?.prompt;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
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
          maxOutputTokens: 4096,
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

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    upstream.data.on("error", (error) => {
      console.error("AI stream error:", error.message);

      if (!res.writableEnded) {
        res.end();
      }
    });

    upstream.data.pipe(res);
  } catch (error) {
    const status = error.response?.status || 502;
    let details = error.message;

    if (error.response?.data?.on) {
      details = await readErrorStream(error.response.data);
    }

    console.error("AI request error:", {
      status,
      details,
    });

    if (!res.headersSent) {
      res.status(status).json({
        error: "AI service request failed",
        details,
      });
    }
  }
});

module.exports = router;
