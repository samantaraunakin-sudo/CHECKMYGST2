import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function registerRoutes(app: Express): Promise<Server> {

  // AI Invoice Extraction from image
  app.post("/api/extract-invoice", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
        `You are an expert at reading Indian GST invoices — including handwritten, printed, and messy bills in Hindi or English.

Extract ALL details from this invoice image. Return ONLY this exact JSON format, nothing else:

{
  "supplierName": "string — business name of the seller",
  "supplierGSTIN": "string — 15-character GSTIN of seller",
  "invoiceNumber": "string — invoice/bill number",
  "invoiceDate": "string — date in DD/MM/YYYY format",
  "items": [
    {
      "description": "string — product or service name",
      "hsn": "string — HSN or SAC code if visible",
      "quantity": 1,
      "rate": 0,
      "gstRate": 18,
      "taxableAmount": 0,
      "gstAmount": 0,
      "totalAmount": 0
    }
  ],
  "subtotal": 0,
  "totalGST": 0,
  "roundOff": 0,
  "grandTotal": 0
}

RULES:
- Extract EVERY line item separately
- If quantity not shown, use 1
- If rate not shown but taxable amount is, use taxableAmount as rate with quantity 1
- HSN codes are 4-8 digit numbers
- GSTIN is always 15 characters
- If field not visible, use "" for strings and 0 for numbers
- Return ONLY valid JSON — no explanation, no markdown, no backticks`,
      ]);

      const text = result.response.text().replace(/```json|```/g, "").trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not extract invoice data" });
      }

      const invoiceData = JSON.parse(jsonMatch[0]);

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

  // AI HSN Code Lookup — product name → HSN + GST rate
  app.post("/api/hsn-lookup", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "query is required" });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(
        `You are an Indian GST HSN/SAC code expert.

For this product or service: "${query}"

Return ONLY this JSON object — no explanation, no markdown, no backticks:
{
  "hsn": "HSN code 4-8 digits",
  "description": "official GST description",
  "gstRate": 18,
  "category": "goods"
}

Examples: TMT steel bars → hsn 7214 gstRate 18, Cement → hsn 2523 gstRate 28, Rice → hsn 1006 gstRate 0`
      );

      const text = result.response.text().replace(/```json|```/g, "").trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(422).json({ error: "Could not find HSN" });
      res.json(JSON.parse(jsonMatch[0]));
    } catch (error) {
      console.error("HSN lookup error:", error);
      res.status(500).json({ error: "Failed to lookup HSN code" });
    }
  });

  // HSN Reverse Lookup — HSN code → product name + GST rate
  app.post("/api/hsn-reverse-lookup", async (req, res) => {
    try {
      const { hsn } = req.body;
      if (!hsn) return res.status(400).json({ error: "hsn is required" });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(
        `You are an Indian GST HSN/SAC code expert.

For HSN/SAC code: "${hsn}"

Return ONLY this JSON — no explanation, no markdown, no backticks:
{
  "hsn": "${hsn}",
  "description": "official product description for this HSN code",
  "gstRate": 18,
  "category": "goods"
}`
      );

      const text = result.response.text().replace(/```json|```/g, "").trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(422).json({ error: "Could not find HSN data" });
      res.json(JSON.parse(jsonMatch[0]));
    } catch (error) {
      console.error("HSN reverse lookup error:", error);
      res.status(500).json({ error: "Failed to lookup HSN" });
    }
  });

  // GSTR-2B extraction
  app.post("/api/extract-gstr2b", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "text is required" });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(
        `Extract all B2B invoice entries from this GSTR-2B data:

${text}

Return ONLY a JSON array — no explanation, no markdown, no backticks:
[{
  "supplierName": "",
  "supplierGSTIN": "",
  "invoiceNumber": "",
  "invoiceDate": "",
  "taxableAmount": 0,
  "igst": 0,
  "cgst": 0,
  "sgst": 0,
  "totalITC": 0,
  "gstRate": 0,
  "period": ""
}]`
      );

      const responseText = result.response.text().replace(/```json|```/g, "").trim();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return res.status(422).json({ error: "Could not extract GSTR-2B data" });
      res.json(JSON.parse(jsonMatch[0]));
    } catch (error) {
      console.error("GSTR-2B extraction error:", error);
      res.status(500).json({ error: "Failed to extract GSTR-2B data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}