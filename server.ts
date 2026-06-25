import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
const PORT = 3000;

// Configure multer for handling file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// API route to analyze chart image
app.post("/api/analyze-chart", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const { buffer, mimetype } = req.file;
    const base64Image = buffer.toString("base64");

    const prompt = `
      You are an expert crypto and stock trader. Analyze this chart image.
      Provide the following details based on your analysis to construct a DCA (Dollar Cost Averaging) strategy:
      - startPrice: The recommended starting entry price for the DCA strategy (nearest current support/resistance).
      - endPrice: The recommended end price for the DCA strategy (deep support or major resistance).
      - targetPrice: The take-profit target price.
      - positionType: Either "long" or "short".
      
      Respond STRICTLY in JSON format without any markdown wrappers or additional text.
      Example:
      {
        "startPrice": 50000,
        "endPrice": 45000,
        "targetPrice": 55000,
        "positionType": "long"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: mimetype, data: base64Image } }] }
      ]
    });

    const text = response.text();
    // Sometimes the model might wrap in ```json ... ``` despite instructions. Handle it:
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
      const parsed = JSON.parse(cleanText);
      res.json(parsed);
    } catch (parseError) {
      console.error("Failed to parse JSON:", cleanText);
      res.status(500).json({ error: "Failed to parse AI response into JSON format." });
    }

  } catch (error) {
    console.error("Error analyzing chart:", error);
    res.status(500).json({ error: "Failed to analyze chart image" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
