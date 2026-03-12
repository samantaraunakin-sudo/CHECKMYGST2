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

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

  // HSN Database — no AI needed, works forever
  const HSN_DB: Record<string, {description: string, gstRate: number, category: string}> = {
    "0101": {description:"Live horses and asses",gstRate:0,category:"goods"},
    "0201": {description:"Meat of bovine animals fresh",gstRate:0,category:"goods"},
    "0301": {description:"Live fish",gstRate:0,category:"goods"},
    "0401": {description:"Milk and cream",gstRate:0,category:"goods"},
    "0701": {description:"Potatoes fresh or chilled",gstRate:0,category:"goods"},
    "0702": {description:"Tomatoes fresh or chilled",gstRate:0,category:"goods"},
    "0901": {description:"Coffee",gstRate:5,category:"goods"},
    "0902": {description:"Tea",gstRate:5,category:"goods"},
    "1001": {description:"Wheat and meslin",gstRate:0,category:"goods"},
    "1006": {description:"Rice",gstRate:0,category:"goods"},
    "1101": {description:"Wheat or meslin flour",gstRate:0,category:"goods"},
    "1701": {description:"Cane or beet sugar",gstRate:5,category:"goods"},
    "1901": {description:"Malt extract and food preparations",gstRate:18,category:"goods"},
    "2101": {description:"Extracts of coffee tea or mate",gstRate:18,category:"goods"},
    "2201": {description:"Waters including mineral waters",gstRate:18,category:"goods"},
    "2202": {description:"Waters with added sugar or flavour",gstRate:28,category:"goods"},
    "2203": {description:"Beer made from malt",gstRate:28,category:"goods"},
    "2207": {description:"Undenatured ethyl alcohol",gstRate:18,category:"goods"},
    "2401": {description:"Unmanufactured tobacco",gstRate:28,category:"goods"},
    "2501": {description:"Salt and pure sodium chloride",gstRate:0,category:"goods"},
    "2523": {description:"Portland cement",gstRate:28,category:"goods"},
    "2701": {description:"Coal and lignite",gstRate:5,category:"goods"},
    "2710": {description:"Petroleum oils",gstRate:18,category:"goods"},
    "2716": {description:"Electrical energy",gstRate:0,category:"goods"},
    "2811": {description:"Other inorganic acids",gstRate:18,category:"goods"},
    "3004": {description:"Medicaments",gstRate:12,category:"goods"},
    "3208": {description:"Paints and varnishes",gstRate:18,category:"goods"},
    "3301": {description:"Essential oils",gstRate:18,category:"goods"},
    "3401": {description:"Soap and organic surface active products",gstRate:18,category:"goods"},
    "3402": {description:"Organic surface active agents and detergents",gstRate:18,category:"goods"},
    "3808": {description:"Insecticides and pesticides",gstRate:18,category:"goods"},
    "3901": {description:"Polymers of ethylene",gstRate:18,category:"goods"},
    "3923": {description:"Plastic articles for packing",gstRate:18,category:"goods"},
    "4002": {description:"Synthetic rubber",gstRate:18,category:"goods"},
    "4011": {description:"New pneumatic tyres of rubber",gstRate:28,category:"goods"},
    "4415": {description:"Packing cases and boxes of wood",gstRate:12,category:"goods"},
    "4802": {description:"Uncoated paper and paperboard",gstRate:12,category:"goods"},
    "4819": {description:"Cartons boxes and cases of paper",gstRate:12,category:"goods"},
    "4901": {description:"Printed books",gstRate:0,category:"goods"},
    "5208": {description:"Woven fabrics of cotton",gstRate:5,category:"goods"},
    "5407": {description:"Woven fabrics of synthetic yarn",gstRate:12,category:"goods"},
    "5603": {description:"Nonwovens",gstRate:12,category:"goods"},
    "6101": {description:"Overcoats and jackets of wool",gstRate:5,category:"goods"},
    "6109": {description:"T-shirts and vests of cotton",gstRate:5,category:"goods"},
    "6203": {description:"Men suits trousers and shorts",gstRate:12,category:"goods"},
    "6204": {description:"Women suits dresses and skirts",gstRate:12,category:"goods"},
    "6305": {description:"Sacks and bags for packing",gstRate:12,category:"goods"},
    "6901": {description:"Bricks and building blocks of ceramic",gstRate:5,category:"goods"},
    "6910": {description:"Ceramic sinks and wash basins",gstRate:18,category:"goods"},
    "7010": {description:"Glass carboys bottles and jars",gstRate:18,category:"goods"},
    "7213": {description:"Wire rods of iron or non-alloy steel",gstRate:18,category:"goods"},
    "7214": {description:"Bars and rods of iron or non-alloy steel",gstRate:18,category:"goods"},
    "7215": {description:"Other bars and rods of iron or steel",gstRate:18,category:"goods"},
    "7216": {description:"Angles shapes and sections of iron",gstRate:18,category:"goods"},
    "7217": {description:"Wire of iron or non-alloy steel",gstRate:18,category:"goods"},
    "7219": {description:"Flat rolled products of stainless steel",gstRate:18,category:"goods"},
    "7308": {description:"Structures and parts of iron or steel",gstRate:18,category:"goods"},
    "7312": {description:"Stranded wire ropes and cables of iron",gstRate:18,category:"goods"},
    "7317": {description:"Nails tacks staples of iron or steel",gstRate:18,category:"goods"},
    "7318": {description:"Screws bolts nuts washers of iron or steel",gstRate:18,category:"goods"},
    "7323": {description:"Table kitchen household articles of iron",gstRate:12,category:"goods"},
    "7610": {description:"Aluminium structures doors windows and frames",gstRate:18,category:"goods"},
    "8301": {description:"Padlocks and locks of base metal",gstRate:18,category:"goods"},
    "8302": {description:"Hinges and mountings of base metal",gstRate:18,category:"goods"},
    "8407": {description:"Spark ignition reciprocating engines",gstRate:28,category:"goods"},
    "8408": {description:"Compression ignition engines diesel",gstRate:28,category:"goods"},
    "8414": {description:"Air pumps vacuum pumps and fans",gstRate:18,category:"goods"},
    "8415": {description:"Air conditioning machines",gstRate:28,category:"goods"},
    "8418": {description:"Refrigerators freezers and heat pumps",gstRate:18,category:"goods"},
    "8421": {description:"Centrifuges and filtering machinery",gstRate:18,category:"goods"},
    "8422": {description:"Dish washing machines",gstRate:18,category:"goods"},
    "8443": {description:"Printing machinery and ink jet printers",gstRate:18,category:"goods"},
    "8450": {description:"Washing machines",gstRate:18,category:"goods"},
    "8471": {description:"Computers automatic data processing machines",gstRate:18,category:"goods"},
    "8481": {description:"Taps cocks valves for pipes",gstRate:18,category:"goods"},
    "8501": {description:"Electric motors and generators",gstRate:18,category:"goods"},
    "8504": {description:"Transformers and static converters",gstRate:18,category:"goods"},
    "8507": {description:"Electric accumulators and batteries",gstRate:18,category:"goods"},
    "8517": {description:"Telephone sets and smartphones",gstRate:18,category:"goods"},
    "8528": {description:"Television receivers and monitors",gstRate:28,category:"goods"},
    "8536": {description:"Electrical switches sockets and connectors",gstRate:18,category:"goods"},
    "8544": {description:"Insulated wire cable and conductors",gstRate:18,category:"goods"},
    "8703": {description:"Motor cars and passenger vehicles",gstRate:28,category:"goods"},
    "8711": {description:"Motorcycles and mopeds",gstRate:28,category:"goods"},
    "9001": {description:"Optical fibres and optical lenses",gstRate:12,category:"goods"},
    "9018": {description:"Instruments for medical surgical dental use",gstRate:12,category:"goods"},
    "9021": {description:"Orthopaedic appliances and splints",gstRate:12,category:"goods"},
    "9025": {description:"Thermometers and pyrometers",gstRate:18,category:"goods"},
    "9030": {description:"Oscilloscopes spectrum analysers",gstRate:18,category:"goods"},
    "9401": {description:"Seats and chairs",gstRate:18,category:"goods"},
    "9403": {description:"Furniture and parts thereof",gstRate:18,category:"goods"},
    "9404": {description:"Mattresses pillows and sleeping bags",gstRate:18,category:"goods"},
    "9503": {description:"Toys tricycles and scale models",gstRate:12,category:"goods"},
    "9506": {description:"Sports equipment and gymnasium goods",gstRate:12,category:"goods"},
    "9601": {description:"Worked ivory bone and similar materials",gstRate:12,category:"goods"},
    "9619": {description:"Sanitary towels tampons and diapers",gstRate:12,category:"goods"},
  };

  // Product name keyword map for forward lookup
  const KEYWORD_MAP: Array<{keywords: string[], hsn: string}> = [
    {keywords:["tmt","steel bar","rod","iron rod","bar","rebar","reinforcement bar"],hsn:"7214"},
    {keywords:["wire rod","steel wire rod"],hsn:"7213"},
    {keywords:["angle","channel","section","beam","joist","steel section"],hsn:"7216"},
    {keywords:["steel wire","iron wire","gi wire","binding wire"],hsn:"7217"},
    {keywords:["stainless steel","ss sheet","ss plate"],hsn:"7219"},
    {keywords:["steel structure","fabricated structure","ms structure"],hsn:"7308"},
    {keywords:["rope","cable","strand","steel rope"],hsn:"7312"},
    {keywords:["nail","tack","staple","pin"],hsn:"7317"},
    {keywords:["screw","bolt","nut","washer","fastener"],hsn:"7318"},
    {keywords:["bucket","pan","tray","container","utensil","vessel"],hsn:"7323"},
    {keywords:["aluminium","aluminum","alum door","alum window","alum frame"],hsn:"7610"},
    {keywords:["cement","opc","ppc","portland"],hsn:"2523"},
    {keywords:["brick","block","tile","building block","clay brick"],hsn:"6901"},
    {keywords:["paint","varnish","lacquer","enamel","coating"],hsn:"3208"},
    {keywords:["pipe","tube","fitting","pvc pipe","ms pipe"],hsn:"3923"},
    {keywords:["lock","padlock","deadbolt"],hsn:"8301"},
    {keywords:["hinge","handle","door fitting","window fitting","knob"],hsn:"8302"},
    {keywords:["fan","exhaust","blower","air pump","vacuum pump"],hsn:"8414"},
    {keywords:["ac","air conditioner","air conditioning","split ac","window ac"],hsn:"8415"},
    {keywords:["fridge","refrigerator","freezer","deep freezer"],hsn:"8418"},
    {keywords:["washing machine","washer","laundry machine"],hsn:"8450"},
    {keywords:["computer","laptop","desktop","server","pc","processor","cpu"],hsn:"8471"},
    {keywords:["valve","tap","cock","faucet","stopcock"],hsn:"8481"},
    {keywords:["motor","generator","dynamo","alternator"],hsn:"8501"},
    {keywords:["transformer","inverter","converter","ups","stabilizer"],hsn:"8504"},
    {keywords:["battery","accumulator","cell","power bank"],hsn:"8507"},
    {keywords:["phone","mobile","smartphone","telephone"],hsn:"8517"},
    {keywords:["tv","television","monitor","display","screen"],hsn:"8528"},
    {keywords:["switch","socket","plug","connector","mcb","rccb","switchgear"],hsn:"8536"},
    {keywords:["wire","cable","conductor","insulated wire","electrical wire"],hsn:"8544"},
    {keywords:["car","vehicle","automobile","sedan","suv","hatchback"],hsn:"8703"},
    {keywords:["bike","motorcycle","scooter","two wheeler","moped"],hsn:"8711"},
    {keywords:["soap","detergent","washing powder","cleaning agent","dishwash"],hsn:"3401"},
    {keywords:["medicine","tablet","capsule","syrup","drug","pharmaceutical"],hsn:"3004"},
    {keywords:["rice","basmati","parboiled rice"],hsn:"1006"},
    {keywords:["wheat","atta","flour","maida","wheat flour"],hsn:"1001"},
    {keywords:["sugar","jaggery","gur"],hsn:"1701"},
    {keywords:["tea","chai","green tea"],hsn:"0902"},
    {keywords:["coffee","nescafe","espresso"],hsn:"0901"},
    {keywords:["milk","cream","dairy","paneer","curd","ghee"],hsn:"0401"},
    {keywords:["coal","lignite","coke"],hsn:"2701"},
    {keywords:["petrol","diesel","petroleum","fuel","lubricant","oil"],hsn:"2710"},
    {keywords:["plastic","polythene","pp","hdpe","ldpe","plastic sheet"],hsn:"3901"},
    {keywords:["tyre","tire","tube"],hsn:"4011"},
    {keywords:["paper","paperboard","cardboard","stationery"],hsn:"4802"},
    {keywords:["book","textbook","printed book","notebook"],hsn:"4901"},
    {keywords:["shirt","tshirt","t-shirt","vest","top"],hsn:"6109"},
    {keywords:["trouser","pant","jeans","shorts","men wear"],hsn:"6203"},
    {keywords:["dress","saree","kurti","ladies wear","women wear"],hsn:"6204"},
    {keywords:["furniture","chair","table","sofa","desk","almirah","cabinet"],hsn:"9403"},
    {keywords:["seat","stool","bench","office chair"],hsn:"9401"},
    {keywords:["mattress","pillow","cushion","sleeping bag","bedding"],hsn:"9404"},
    {keywords:["toy","game","doll","puzzle","board game"],hsn:"9503"},
    {keywords:["sports","cricket","football","badminton","gym equipment"],hsn:"9506"},
    {keywords:["diaper","sanitary","napkin","pad"],hsn:"9619"},
    {keywords:["insecticide","pesticide","fertilizer","herbicide"],hsn:"3808"},
    {keywords:["rubber","synthetic rubber","latex"],hsn:"4002"},
    {keywords:["glass","bottle","jar","glassware"],hsn:"7010"},
    {keywords:["sink","basin","commode","sanitary ware","ceramic"],hsn:"6910"},
    {keywords:["optical","lens","fibre optic"],hsn:"9001"},
    {keywords:["medical device","surgical","stethoscope","bp machine"],hsn:"9018"},
    {keywords:["thermometer","pyrometer","temperature"],hsn:"9025"},
    {keywords:["salt","sodium chloride","iodized salt"],hsn:"2501"},
  ];

  // AI HSN Code Lookup — product name → HSN + GST rate (LOCAL, no API)
  app.post("/api/hsn-lookup", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "query is required" });
      const q = query.toLowerCase().trim();
      let foundHsn = "";
      for (const entry of KEYWORD_MAP) {
        if (entry.keywords.some(k => q.includes(k))) {
          foundHsn = entry.hsn;
          break;
        }
      }
      if (foundHsn && HSN_DB[foundHsn]) {
        return res.json({ hsn: foundHsn, ...HSN_DB[foundHsn] });
      }
      // Fallback: try partial HSN match in DB descriptions
      for (const [hsn, data] of Object.entries(HSN_DB)) {
        if (data.description.toLowerCase().includes(q)) {
          return res.json({ hsn, ...data });
        }
      }
      // Default fallback
      return res.json({ hsn: "9999", description: query, gstRate: 18, category: "goods" });
    } catch (error) {
      console.error("HSN lookup error:", error);
      res.status(500).json({ error: "Failed to lookup HSN code" });
    }
  });

  // HSN Reverse Lookup — HSN code → product name + GST rate (LOCAL, no API)
  app.post("/api/hsn-reverse-lookup", async (req, res) => {
    try {
      const { hsn } = req.body;
      if (!hsn) return res.status(400).json({ error: "hsn is required" });
      const code = hsn.toString().trim();
      // Try exact match first
      if (HSN_DB[code]) {
        return res.json({ hsn: code, ...HSN_DB[code] });
      }
      // Try first 4 digits
      const code4 = code.substring(0, 4);
      if (HSN_DB[code4]) {
        return res.json({ hsn: code4, ...HSN_DB[code4] });
      }
      // Try first 2 digits chapter
      const code2 = code.substring(0, 2);
      for (const [h, data] of Object.entries(HSN_DB)) {
        if (h.startsWith(code2)) {
          return res.json({ hsn: h, ...data });
        }
      }
      return res.json({ hsn: code, description: "Goods", gstRate: 18, category: "goods" });
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

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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