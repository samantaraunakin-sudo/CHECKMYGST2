import type { Express } from "express";
import { createServer, type Server } from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {

  // AI Invoice Extraction from image
  app.post("/api/extract-invoice", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `Extract GST invoice details from this image. Return a JSON object with these exact fields:
{
  "supplierName": "string",
  "supplierGSTIN": "string (15-char GSTIN format)",
  "invoiceNumber": "string",
  "invoiceDate": "string (DD/MM/YYYY format)",
  "hsn": "string (HSN/SAC code)",
  "gstRate": number (percentage like 18, 12, 5, 0),
  "taxableAmount": number,
  "gstAmount": number,
  "totalAmount": number,
  "description": "string (product/service description)"
}
Return ONLY valid JSON, no explanation. If a field is not found, use empty string "" for strings and 0 for numbers.`,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return res.status(500).json({ error: "Unexpected AI response" });
      }

      // Parse JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not extract invoice data from image" });
      }

      const invoiceData = JSON.parse(jsonMatch[0]);
      res.json(invoiceData);
    } catch (error) {
      console.error("Invoice extraction error:", error);
      res.status(500).json({ error: "Failed to extract invoice data" });
    }
  });

  // AI HSN Code Lookup
  app.post("/api/hsn-lookup", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "query is required" });
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are a GST HSN code expert for India. For the product/service description: "${query}"

Return a JSON array of up to 3 best matching HSN/SAC codes:
[
  {
    "hsn": "string (HSN/SAC code)",
    "description": "string (official description)",
    "gstRate": number (applicable GST rate percentage),
    "category": "string (goods or services)",
    "confidence": "high" | "medium" | "low"
  }
]

Return ONLY valid JSON array, no explanation. Be accurate for Indian GST HSN codes.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return res.status(500).json({ error: "Unexpected AI response" });
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not find HSN codes" });
      }

      const hsnData = JSON.parse(jsonMatch[0]);
      res.json(hsnData);
    } catch (error) {
      console.error("HSN lookup error:", error);
      res.status(500).json({ error: "Failed to lookup HSN code" });
    }
  });

  // GSTR-2B text extraction
  app.post("/api/extract-gstr2b", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "text is required" });
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are a GST expert. Extract all B2B invoice entries from this GSTR-2B data:

${text}

Return a JSON array where each item has:
[
  {
    "supplierName": "string",
    "supplierGSTIN": "string",
    "invoiceNumber": "string",
    "invoiceDate": "string",
    "taxableAmount": number,
    "igst": number,
    "cgst": number,
    "sgst": number,
    "totalITC": number,
    "gstRate": number
  }
]

Return ONLY valid JSON array. Extract as many entries as you can find.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return res.status(500).json({ error: "Unexpected AI response" });
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not extract GSTR-2B data" });
      }

      const gstr2bData = JSON.parse(jsonMatch[0]);
      res.json(gstr2bData);
    } catch (error) {
      console.error("GSTR-2B extraction error:", error);
      res.status(500).json({ error: "Failed to extract GSTR-2B data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
