// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import { GoogleGenerativeAI } from "@google/generative-ai";
var genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
async function registerRoutes(app2) {
  app2.post("/api/extract-invoice", async (req, res) => {
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
            data: imageBase64
          }
        },
        `You are an expert at reading Indian GST invoices \u2014 including handwritten, printed, and messy bills in Hindi or English.

Extract ALL details from this invoice image. Return ONLY this exact JSON format, nothing else:

{
  "supplierName": "string \u2014 business name of the seller",
  "supplierGSTIN": "string \u2014 15-character GSTIN of seller",
  "invoiceNumber": "string \u2014 invoice/bill number",
  "invoiceDate": "string \u2014 date in DD/MM/YYYY format",
  "items": [
    {
      "description": "string \u2014 product or service name",
      "hsn": "string \u2014 HSN or SAC code if visible",
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
- Return ONLY valid JSON \u2014 no explanation, no markdown, no backticks`
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
      if (!query) return res.status(400).json({ error: "query is required" });
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(
        `You are an Indian GST HSN/SAC code expert.

For this product or service: "${query}"

Return ONLY this JSON object \u2014 no explanation, no markdown, no backticks:
{
  "hsn": "HSN code 4-8 digits",
  "description": "official GST description",
  "gstRate": 18,
  "category": "goods"
}

Examples: TMT steel bars \u2192 hsn 7214 gstRate 18, Cement \u2192 hsn 2523 gstRate 28, Rice \u2192 hsn 1006 gstRate 0`
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
  app2.post("/api/hsn-reverse-lookup", async (req, res) => {
    try {
      const { hsn } = req.body;
      if (!hsn) return res.status(400).json({ error: "hsn is required" });
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(
        `You are an Indian GST HSN/SAC code expert.

For HSN/SAC code: "${hsn}"

Return ONLY this JSON \u2014 no explanation, no markdown, no backticks:
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
  app2.post("/api/extract-gstr2b", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "text is required" });
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(
        `Extract all B2B invoice entries from this GSTR-2B data:

${text}

Return ONLY a JSON array \u2014 no explanation, no markdown, no backticks:
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
