// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
var anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY
});
async function registerRoutes(app2) {
  app2.post("/api/extract-invoice", async (req, res) => {
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
                  data: imageBase64
                }
              },
              {
                type: "text",
                text: `You are an expert at reading Indian GST invoices \u2014 including handwritten, printed, and messy bills in Hindi or English.

Extract ALL details from this invoice image. Return ONLY this exact JSON format, nothing else:

{
  "supplierName": "string \u2014 business name of the seller",
  "supplierGSTIN": "string \u2014 15-character GSTIN of seller, e.g. 27AAPFU0939F1ZV",
  "invoiceNumber": "string \u2014 invoice/bill number",
  "invoiceDate": "string \u2014 date in DD/MM/YYYY format",
  "items": [
    {
      "description": "string \u2014 product or service name",
      "hsn": "string \u2014 HSN or SAC code if visible",
      "quantity": number \u2014 quantity of items,
      "rate": number \u2014 rate per unit (WITHOUT GST),
      "gstRate": number \u2014 GST percentage (0, 5, 12, 18, or 28),
      "taxableAmount": number \u2014 quantity x rate,
      "gstAmount": number \u2014 taxable x gstRate/100,
      "totalAmount": number \u2014 taxable + gstAmount
    }
  ],
  "subtotal": number \u2014 total taxable amount across all items,
  "totalGST": number \u2014 total GST across all items,
  "roundOff": number \u2014 round off amount if shown (can be negative),
  "grandTotal": number \u2014 final invoice total
}

IMPORTANT RULES:
- Extract EVERY line item separately \u2014 do not combine products
- If quantity is not shown, use 1
- If rate is not shown but taxable amount is, use taxableAmount as rate with quantity 1
- For handwritten bills, read carefully \u2014 numbers may be written in Hindi numerals
- HSN codes are usually 4-8 digit numbers
- GSTIN is always 15 characters alphanumeric
- If a field is truly not visible, use "" for strings and 0 for numbers
- Return ONLY valid JSON \u2014 no explanation, no markdown`
              }
            ]
          }
        ]
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
      if (!invoiceData.items || !Array.isArray(invoiceData.items)) {
        invoiceData.items = [{
          description: invoiceData.description || "",
          hsn: invoiceData.hsn || "",
          quantity: 1,
          rate: invoiceData.taxableAmount || 0,
          gstRate: invoiceData.gstRate || 18,
          taxableAmount: invoiceData.taxableAmount || 0,
          gstAmount: invoiceData.gstAmount || 0,
          totalAmount: invoiceData.totalAmount || 0
        }];
      }
      res.json(invoiceData);
    } catch (error) {
      console.error("Invoice extraction error:", error);
      res.status(500).json({ error: "Failed to extract invoice data" });
    }
  });
  app2.post("/api/hsn-lookup", async (req, res) => {
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

Return ONLY this JSON object \u2014 single best match:
{
  "hsn": "string \u2014 HSN code (4-8 digits) or SAC code (6 digits for services)",
  "description": "string \u2014 official GST description of this product",
  "gstRate": number \u2014 correct GST rate (0, 5, 12, 18, or 28),
  "category": "goods or services"
}

Examples:
- "TMT steel bars" \u2192 hsn: "7214", gstRate: 18
- "Cement 50kg" \u2192 hsn: "2523", gstRate: 28  
- "Rice" \u2192 hsn: "1006", gstRate: 0
- "Mobile phone" \u2192 hsn: "8517", gstRate: 18
- "CA services" \u2192 hsn: "998231", gstRate: 18
- "Wheat flour" \u2192 hsn: "1101", gstRate: 0

Return ONLY valid JSON, no explanation.`
          }
        ]
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
  app2.post("/api/hsn-reverse-lookup", async (req, res) => {
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
  "description": "string \u2014 official product/service description for this HSN code",
  "gstRate": number \u2014 correct GST rate (0, 5, 12, 18, or 28),
  "category": "goods or services"
}

Return ONLY valid JSON, no explanation.`
          }
        ]
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
  app2.post("/api/extract-gstr2b", async (req, res) => {
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

Return ONLY valid JSON array. Extract as many entries as you can find.`
          }
        ]
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
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origin = req.header("origin") || "";
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    });
    next();
  });
}
function serveStaticApp(app2) {
  const staticPath = path.resolve(process.cwd(), "static-build", "web");
  if (fs.existsSync(staticPath)) {
    log(`Serving static build from: ${staticPath}`);
    app2.use(express.static(staticPath));
    app2.use((req, res) => {
      if (req.path.startsWith("/api")) return;
      const indexPath = path.join(staticPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build not found.");
      }
    });
  } else {
    app2.get("/", (_req, res) => {
      res.json({ status: "CheckMyGST API running" });
    });
  }
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const error = err;
    console.error("Server error:", err);
    if (res.headersSent) return;
    res.status(error.status || 500).json({ message: error.message || "Internal Server Error" });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  const server = await registerRoutes(app);
  serveStaticApp(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0" }, () => {
    log(`\u2705 CheckMyGST server running on port ${port}`);
  });
})();
