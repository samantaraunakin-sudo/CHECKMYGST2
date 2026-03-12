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
        model: "claude-haiku-4-5-20251001",
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
                text: `You are an expert at reading Indian GST invoices — including handwritten, printed, and messy bills in Hindi or English.

Extract ALL details from this invoice image. Return ONLY this exact JSON format, nothing else:

{
  "supplierName": "string — business name of the seller",
  "supplierGSTIN": "string — 15-character GSTIN of seller, e.g. 27AAPFU0939F1ZV",
  "invoiceNumber": "string — invoice/bill number",
  "invoiceDate": "string — date in DD/MM/YYYY format",
  "items": [
    {
      "description": "string — product or service name",
      "hsn": "string — HSN or SAC code if visible",
      "quantity": number — quantity of items,
      "rate": number — rate per unit (WITHOUT GST),
      "gstRate": number — GST percentage (0, 5, 12, 18, or 28),
      "taxableAmount": number — quantity x rate,
      "gstAmount": number — taxable x gstRate/100,
      "totalAmount": number — taxable + gstAmount
    }
  ],
  "subtotal": number — total taxable amount across all items,
  "totalGST": number — total GST across all items,
  "roundOff": number — round off amount if shown (can be negative),
  "grandTotal": number — final invoice total
}

IMPORTANT RULES:
- Extract EVERY line item separately — do not combine products
- If quantity is not shown, use 1
- If rate is not shown but taxable amount is, use taxableAmount as rate with quantity 1
- For handwritten bills, read carefully — numbers may be written in Hindi numerals
- HSN codes are usually 4-8 digit numbers
- GSTIN is always 15 characters alphanumeric
- If a field is truly not visible, use "" for strings and 0 for numbers
- Return ONLY valid JSON — no explanation, no markdown`,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return res.status(500).json({ error: "Unexpected AI response" });
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not extract invoice data from image" });
      }

      const invoiceData = JSON.parse(jsonMatch[0]);

      // Ensure items array exists
      if (!invoiceData.items || !Array.isArray(invoiceData.items)) {
        invoiceData.items = [{
          description: invoiceData.description || "",
          hsn: invoiceData.hsn || "",
          quantity: 1,
          rate: invoiceData.taxableAmount || 0,
          gstRate: invoiceData.gstRate || 18,
          taxableAmount: invoiceData.taxableAmount || 0,
          gstAmount: invoiceData.gstAmount || 0,
          totalAmount: invoiceData.totalAmount || 0,
        }];
      }

      res.json(invoiceData);
    } catch (error) {
      console.error("Invoice extraction error:", error);
      res.status(500).json({ error: "Failed to extract invoice data" });
    }
  });

  // AI HSN Code Lookup — returns single best match
  app.post("/api/hsn-lookup", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "query is required" });
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are an Indian GST HSN/SAC code expert.

For this product or service: "${query}"

Return ONLY this JSON object — single best match:
{
  "hsn": "string — HSN code (4-8 digits) or SAC code (6 digits for services)",
  "description": "string — official GST description of this product",
  "gstRate": number — correct GST rate (0, 5, 12, 18, or 28),
  "category": "goods or services"
}

Examples:
- "TMT steel bars" → hsn: "7214", gstRate: 18
- "Cement 50kg" → hsn: "2523", gstRate: 28  
- "Rice" → hsn: "1006", gstRate: 0
- "Mobile phone" → hsn: "8517", gstRate: 18
- "CA services" → hsn: "998231", gstRate: 18
- "Wheat flour" → hsn: "1101", gstRate: 0

Return ONLY valid JSON, no explanation.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return res.status(500).json({ error: "Unexpected AI response" });
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not find HSN code" });
      }

      const hsnData = JSON.parse(jsonMatch[0]);
      res.json(hsnData);
    } catch (error) {
      console.error("HSN lookup error:", error);
      res.status(500).json({ error: "Failed to lookup HSN code" });
    }
  });

  // HSN code reverse lookup — enter code, get product + GST rate
  app.post("/api/hsn-reverse-lookup", async (req, res) => {
    try {
      const { hsn } = req.body;
      if (!hsn) {
        return res.status(400).json({ error: "hsn is required" });
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `You are an Indian GST HSN/SAC code expert.

For HSN/SAC code: "${hsn}"

Return ONLY this JSON:
{
  "hsn": "${hsn}",
  "description": "string — official product/service description for this HSN code",
  "gstRate": number — correct GST rate (0, 5, 12, 18, or 28),
  "category": "goods or services"
}

Return ONLY valid JSON, no explanation.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return res.status(500).json({ error: "Unexpected AI response" });
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not find HSN data" });
      }

      res.json(JSON.parse(jsonMatch[0]));
    } catch (error) {
      console.error("HSN reverse lookup error:", error);
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
        model: "claude-haiku-4-5-20251001",
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
    "gstRate": number,
    "period": "string"
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