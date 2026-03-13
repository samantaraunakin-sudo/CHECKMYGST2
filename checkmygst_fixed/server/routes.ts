import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import session from "express-session";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function registerRoutes(app: Express): Promise<Server> {

  // AI Invoice Extraction from image — uses Groq (free, 14400/day, no limits)
  app.post("/api/extract-invoice", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });
      const chatCompletion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` }
              },
              {
                type: "text",
                text: `You are an expert at reading Indian GST invoices including handwritten and printed bills in Hindi or English.
Extract ALL details from this invoice image. Return ONLY valid JSON, no explanation, no markdown:
{
  "supplierName": "business name of seller",
  "supplierGSTIN": "15-character GSTIN or empty string",
  "invoiceNumber": "invoice/bill number",
  "invoiceDate": "date in DD/MM/YYYY format",
  "items": [
    {
      "description": "product or service name",
      "hsn": "HSN or SAC code if visible else empty string",
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
If any field is not visible, use empty string for text or 0 for numbers. For gstRate use only: 0, 5, 12, 18, or 28.`
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });
      const text = chatCompletion.choices[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(422).json({ error: "Could not extract invoice data" });
      const data = JSON.parse(jsonMatch[0]);
      res.json(data);
    } catch (error) {
      console.error("Invoice extraction error:", error);
      res.status(500).json({ error: "Failed to extract invoice data", detail: String(error) });
    }
  });

  // HSN Database — no AI needed, works   // ============================================================
  const HSN_DB: Record<string, {description: string, gstRate: number, category: string}> = {
    // CHAPTER 01-10: Agriculture & Food
    "0101": {description:"Live horses and asses",gstRate:0,category:"goods"},
    "0201": {description:"Meat of bovine animals fresh",gstRate:0,category:"goods"},
    "0301": {description:"Live fish",gstRate:0,category:"goods"},
    "0302": {description:"Fresh or chilled fish",gstRate:5,category:"goods"},
    "0401": {description:"Milk and cream fresh",gstRate:0,category:"goods"},
    "0402": {description:"Milk powder and condensed milk",gstRate:5,category:"goods"},
    "0406": {description:"Cheese and curd",gstRate:12,category:"goods"},
    "0407": {description:"Birds eggs in shell",gstRate:0,category:"goods"},
    "0701": {description:"Potatoes fresh or chilled",gstRate:0,category:"goods"},
    "0702": {description:"Tomatoes fresh or chilled",gstRate:0,category:"goods"},
    "0703": {description:"Onions garlic and leeks",gstRate:0,category:"goods"},
    "0714": {description:"Roots and tubers with high starch",gstRate:0,category:"goods"},
    "0901": {description:"Coffee unroasted",gstRate:0,category:"goods"},
    "0902": {description:"Tea",gstRate:5,category:"goods"},
    // CHAPTER 10-22: Grains, Milling, Sugar, Beverages
    "1001": {description:"Wheat and meslin",gstRate:0,category:"goods"},
    "1006": {description:"Rice",gstRate:0,category:"goods"},
    "1101": {description:"Wheat or meslin flour",gstRate:0,category:"goods"},
    "1102": {description:"Cereal flours other than wheat",gstRate:0,category:"goods"},
    "1701": {description:"Cane or beet sugar",gstRate:5,category:"goods"},
    "1702": {description:"Other sugars including lactose",gstRate:18,category:"goods"},
    "1901": {description:"Malt extract and food preparations",gstRate:18,category:"goods"},
    "2101": {description:"Extracts of coffee tea or mate",gstRate:18,category:"goods"},
    "2106": {description:"Food preparations not elsewhere specified",gstRate:18,category:"goods"},
    "2201": {description:"Mineral water and aerated water without sugar",gstRate:18,category:"goods"},
    "2202": {description:"Waters with added sugar sweetener or flavour",gstRate:28,category:"goods"},
    "2203": {description:"Beer made from malt",gstRate:28,category:"goods"},
    "2207": {description:"Undenatured ethyl alcohol",gstRate:18,category:"goods"},
    "2209": {description:"Vinegar",gstRate:12,category:"goods"},
    // CHAPTER 24-27: Tobacco, Salt, Cement, Fuel
    "2401": {description:"Unmanufactured tobacco",gstRate:28,category:"goods"},
    "2402": {description:"Cigars cigarettes and smoking tobacco",gstRate:28,category:"goods"},
    "2501": {description:"Salt and pure sodium chloride",gstRate:0,category:"goods"},
    "2523": {description:"Portland cement",gstRate:28,category:"goods"},
    "2701": {description:"Coal and lignite",gstRate:5,category:"goods"},
    "2710": {description:"Petroleum oils and lubricants",gstRate:18,category:"goods"},
    "2716": {description:"Electrical energy",gstRate:0,category:"goods"},
    // CHAPTER 28-39: Chemicals, Pharma, Plastics
    "2811": {description:"Other inorganic acids and compounds",gstRate:18,category:"goods"},
    "2814": {description:"Ammonia anhydrous or in aqueous solution",gstRate:18,category:"goods"},
    "3004": {description:"Medicaments medicines and drugs",gstRate:12,category:"goods"},
    "3005": {description:"Wadding gauze bandages and dressings",gstRate:12,category:"goods"},
    "3208": {description:"Paints and varnishes",gstRate:18,category:"goods"},
    "3209": {description:"Paints and varnishes water based",gstRate:18,category:"goods"},
    "3301": {description:"Essential oils and resinoids",gstRate:18,category:"goods"},
    "3304": {description:"Beauty creams and skin care preparations",gstRate:28,category:"goods"},
    "3305": {description:"Hair preparations shampoo conditioner",gstRate:28,category:"goods"},
    "3401": {description:"Soap and organic surface active products",gstRate:18,category:"goods"},
    "3402": {description:"Organic surface active agents detergents",gstRate:18,category:"goods"},
    "3808": {description:"Insecticides pesticides and disinfectants",gstRate:18,category:"goods"},
    "3901": {description:"Polymers of ethylene in primary forms",gstRate:18,category:"goods"},
    "3923": {description:"Plastic articles for packing bottles bags",gstRate:18,category:"goods"},
    "3926": {description:"Other plastic articles",gstRate:18,category:"goods"},
    // CHAPTER 40: Rubber
    "4002": {description:"Synthetic rubber",gstRate:18,category:"goods"},
    "4011": {description:"New pneumatic tyres of rubber",gstRate:28,category:"goods"},
    "4016": {description:"Other articles of vulcanised rubber",gstRate:18,category:"goods"},
    // CHAPTER 44-48: Wood, Paper
    "4415": {description:"Packing cases and boxes of wood",gstRate:12,category:"goods"},
    "4802": {description:"Uncoated paper and paperboard",gstRate:12,category:"goods"},
    "4819": {description:"Cartons boxes and cases of paper",gstRate:12,category:"goods"},
    "4901": {description:"Printed books",gstRate:0,category:"goods"},
    "4902": {description:"Newspapers journals and periodicals",gstRate:0,category:"goods"},
    // CHAPTER 51-63: Textiles, Garments
    "5208": {description:"Woven fabrics of cotton",gstRate:5,category:"goods"},
    "5209": {description:"Woven fabrics of cotton weight over 200g",gstRate:5,category:"goods"},
    "5407": {description:"Woven fabrics of synthetic filament yarn",gstRate:5,category:"goods"},
    "5603": {description:"Nonwovens",gstRate:12,category:"goods"},
    "6101": {description:"Overcoats and jackets of wool or cotton",gstRate:12,category:"goods"},
    "6109": {description:"T-shirts vests and similar knitted garments",gstRate:12,category:"goods"},
    "6203": {description:"Men suits trousers jeans and shorts",gstRate:12,category:"goods"},
    "6204": {description:"Women suits dresses skirts and kurtas",gstRate:12,category:"goods"},
    "6305": {description:"Sacks and bags for packing of jute",gstRate:5,category:"goods"},
    "6306": {description:"Tarpaulins awnings and tents",gstRate:12,category:"goods"},
    // CHAPTER 69-70: Ceramics, Glass
    "6901": {description:"Bricks blocks and tiles of ceramic",gstRate:5,category:"goods"},
    "6902": {description:"Refractory bricks and ceramic tiles",gstRate:18,category:"goods"},
    "6907": {description:"Ceramic flags and paving tiles",gstRate:28,category:"goods"},
    "6910": {description:"Ceramic sinks wash basins and bidets",gstRate:18,category:"goods"},
    "7010": {description:"Glass carboys bottles jars and containers",gstRate:18,category:"goods"},
    // CHAPTER 72-73: Iron and Steel
    "7213": {description:"Wire rods of iron or non-alloy steel",gstRate:18,category:"goods"},
    "7214": {description:"Bars and rods of iron or steel TMT bars",gstRate:18,category:"goods"},
    "7215": {description:"Other bars and rods of iron or steel",gstRate:18,category:"goods"},
    "7216": {description:"Angles shapes channels and sections of iron",gstRate:18,category:"goods"},
    "7217": {description:"Wire of iron or non-alloy steel",gstRate:18,category:"goods"},
    "7219": {description:"Flat rolled products of stainless steel",gstRate:18,category:"goods"},
    "7227": {description:"Bars and rods of alloy steel hot rolled",gstRate:18,category:"goods"},
    "7228": {description:"Other bars and rods of alloy steel",gstRate:18,category:"goods"},
    "7304": {description:"Tubes and pipes seamless of iron or steel",gstRate:18,category:"goods"},
    "7305": {description:"Tubes and pipes of iron or steel welded",gstRate:18,category:"goods"},
    "7306": {description:"Other tubes pipes and hollow profiles",gstRate:18,category:"goods"},
    "7308": {description:"Structures and parts of iron or steel",gstRate:18,category:"goods"},
    "7312": {description:"Stranded wire ropes cables chains of iron",gstRate:18,category:"goods"},
    "7313": {description:"Barbed wire of iron or steel",gstRate:18,category:"goods"},
    "7317": {description:"Nails tacks staples of iron or steel",gstRate:18,category:"goods"},
    "7318": {description:"Screws bolts nuts washers of iron or steel",gstRate:18,category:"goods"},
    "7323": {description:"Table kitchen household articles of iron or steel",gstRate:12,category:"goods"},
    "7325": {description:"Other cast articles of iron or steel",gstRate:18,category:"goods"},
    // CHAPTER 76: Aluminium
    "7604": {description:"Aluminium bars rods and profiles",gstRate:18,category:"goods"},
    "7605": {description:"Aluminium wire",gstRate:18,category:"goods"},
    "7610": {description:"Aluminium structures doors windows and frames",gstRate:18,category:"goods"},
    // CHAPTER 83-85: Hardware, Machinery, Electricals
    "8301": {description:"Padlocks and locks of base metal",gstRate:18,category:"goods"},
    "8302": {description:"Hinges handles mountings of base metal",gstRate:18,category:"goods"},
    "8407": {description:"Spark ignition reciprocating petrol engines",gstRate:28,category:"goods"},
    "8408": {description:"Compression ignition diesel engines",gstRate:28,category:"goods"},
    "8414": {description:"Air pumps vacuum pumps compressors and fans",gstRate:18,category:"goods"},
    "8415": {description:"Air conditioning machines split and window AC",gstRate:28,category:"goods"},
    "8418": {description:"Refrigerators freezers and heat pumps",gstRate:18,category:"goods"},
    "8421": {description:"Centrifuges and filtering machinery",gstRate:18,category:"goods"},
    "8422": {description:"Dish washing machines",gstRate:18,category:"goods"},
    "8443": {description:"Printing machinery and inkjet printers",gstRate:18,category:"goods"},
    "8450": {description:"Household and laundry washing machines",gstRate:18,category:"goods"},
    "8471": {description:"Computers laptops and data processing machines",gstRate:18,category:"goods"},
    "8473": {description:"Parts and accessories of computers",gstRate:18,category:"goods"},
    "8481": {description:"Taps cocks valves for pipes and tanks",gstRate:18,category:"goods"},
    "8501": {description:"Electric motors and generators",gstRate:18,category:"goods"},
    "8502": {description:"Electric generating sets",gstRate:18,category:"goods"},
    "8504": {description:"Transformers static converters UPS and inverters",gstRate:18,category:"goods"},
    "8507": {description:"Electric accumulators batteries and cells",gstRate:18,category:"goods"},
    "8516": {description:"Electric water heaters geysers and irons",gstRate:28,category:"goods"},
    "8517": {description:"Telephone sets mobile phones and smartphones",gstRate:18,category:"goods"},
    "8525": {description:"Transmission cameras and CCTV",gstRate:18,category:"goods"},
    "8528": {description:"Television receivers monitors and projectors",gstRate:28,category:"goods"},
    "8536": {description:"Electrical switches sockets MCB and connectors",gstRate:18,category:"goods"},
    "8537": {description:"Electrical control panels and switchboards",gstRate:18,category:"goods"},
    "8544": {description:"Insulated wire cable and electrical conductors",gstRate:18,category:"goods"},
    // CHAPTER 87: Vehicles
    "8703": {description:"Motor cars passenger vehicles and SUVs",gstRate:28,category:"goods"},
    "8704": {description:"Motor vehicles for goods transport trucks",gstRate:28,category:"goods"},
    "8711": {description:"Motorcycles mopeds and scooters",gstRate:28,category:"goods"},
    "8714": {description:"Parts and accessories of motorcycles",gstRate:28,category:"goods"},
    // CHAPTER 90: Instruments
    "9001": {description:"Optical fibres and optical lenses",gstRate:12,category:"goods"},
    "9018": {description:"Instruments for medical surgical and dental use",gstRate:12,category:"goods"},
    "9021": {description:"Orthopaedic appliances splints and crutches",gstRate:12,category:"goods"},
    "9025": {description:"Thermometers pyrometers and barometers",gstRate:18,category:"goods"},
    "9030": {description:"Oscilloscopes spectrum analysers and meters",gstRate:18,category:"goods"},
    // CHAPTER 94: Furniture
    "9401": {description:"Seats chairs stools and office chairs",gstRate:18,category:"goods"},
    "9403": {description:"Furniture tables wardrobes almirahs and cabinets",gstRate:18,category:"goods"},
    "9404": {description:"Mattresses pillows cushions and sleeping bags",gstRate:18,category:"goods"},
    // CHAPTER 95-96: Toys, Sports, Misc
    "9503": {description:"Toys tricycles dolls and board games",gstRate:12,category:"goods"},
    "9506": {description:"Sports equipment cricket football badminton gym",gstRate:12,category:"goods"},
    "9601": {description:"Worked ivory bone horn materials",gstRate:12,category:"goods"},
    "9619": {description:"Sanitary towels tampons napkins and diapers",gstRate:12,category:"goods"},
    // SERVICES (SAC codes)
    "9954": {description:"Construction services",gstRate:18,category:"service"},
    "9961": {description:"Wholesale trade services",gstRate:18,category:"service"},
    "9962": {description:"Retail trade services",gstRate:18,category:"service"},
    "9971": {description:"Financial and insurance services",gstRate:18,category:"service"},
    "9972": {description:"Real estate services",gstRate:18,category:"service"},
    "9973": {description:"Leasing or rental services",gstRate:18,category:"service"},
    "9983": {description:"IT and technology services",gstRate:18,category:"service"},
    "9984": {description:"Telecommunications services",gstRate:18,category:"service"},
    "9985": {description:"Support services",gstRate:18,category:"service"},
    "9987": {description:"Maintenance repair and installation services",gstRate:18,category:"service"},
    "9988": {description:"Manufacturing services on physical inputs",gstRate:18,category:"service"},
    "9992": {description:"Education services",gstRate:0,category:"service"},
    "9993": {description:"Human health and social care services",gstRate:0,category:"service"},
    "9997": {description:"Other services",gstRate:18,category:"service"},
  };

  // Product name keyword map for forward lookup
  const KEYWORD_MAP: Array<{keywords: string[], hsn: string}> = [
    // Iron & Steel (most important for Kaku - building materials)
    {keywords:["tmt","tmt bar","tmt rod","steel bar","iron bar","reinforcement bar","rebar","tor steel","fe500","fe415"],hsn:"7214"},
    {keywords:["wire rod","steel wire rod","ms wire rod"],hsn:"7213"},
    {keywords:["angle","channel","joist","beam","ms angle","steel angle","ms channel","ismc","ismb"],hsn:"7216"},
    {keywords:["gi wire","binding wire","iron wire","steel wire","ms wire","galvanised wire"],hsn:"7217"},
    {keywords:["stainless steel","ss sheet","ss plate","ss pipe","304 steel","316 steel"],hsn:"7219"},
    {keywords:["ms pipe","gi pipe","steel pipe","iron pipe","erw pipe","seamless pipe"],hsn:"7306"},
    {keywords:["steel structure","ms structure","fabricated structure","ms fabrication"],hsn:"7308"},
    {keywords:["steel rope","wire rope","ms rope","strand"],hsn:"7312"},
    {keywords:["nail","tack","staple","ms nail","wire nail"],hsn:"7317"},
    {keywords:["screw","bolt","nut","washer","fastener","anchor bolt","foundation bolt"],hsn:"7318"},
    {keywords:["bucket","pan","tray","drum","container","utensil","vessel","patila","tub"],hsn:"7323"},
    // Cement & Building
    {keywords:["cement","opc","ppc","portland","acc cement","ultratech","shree cement","ambuja"],hsn:"2523"},
    {keywords:["brick","red brick","fly ash brick","clay brick","building brick"],hsn:"6901"},
    {keywords:["tiles","floor tile","wall tile","ceramic tile","vitrified tile","mosaic"],hsn:"6907"},
    {keywords:["sink","wash basin","commode","toilet","sanitary ware","bathroom fitting"],hsn:"6910"},
    // Aluminium
    {keywords:["aluminium","aluminum","alum door","alum window","alum frame","alum section","alum profile","alum sheet"],hsn:"7610"},
    // Paint & Hardware
    {keywords:["paint","varnish","lacquer","enamel","primer","putty","distemper","asian paint","berger","nerolac"],hsn:"3208"},
    {keywords:["lock","padlock","deadbolt","door lock","window lock"],hsn:"8301"},
    {keywords:["hinge","handle","door handle","window handle","tower bolt","latch","door fitting","window fitting"],hsn:"8302"},
    // PVC & Plastic pipes
    {keywords:["pvc pipe","plastic pipe","upvc pipe","cpvc pipe","pprc pipe","plumbing pipe"],hsn:"3923"},
    // Electrical
    {keywords:["switch","socket","plug","connector","mcb","rccb","elcb","switchgear","modular switch","electrical switch"],hsn:"8536"},
    {keywords:["control panel","switchboard","distribution box","db box","mcc panel"],hsn:"8537"},
    {keywords:["wire","cable","conductor","insulated wire","house wire","building wire","electrical wire","fr wire","flexible wire"],hsn:"8544"},
    {keywords:["motor","electric motor","pump motor","water motor","submersible motor"],hsn:"8501"},
    {keywords:["transformer","inverter","converter","ups","stabilizer","servo stabilizer"],hsn:"8504"},
    {keywords:["battery","accumulator","inverter battery","car battery","truck battery","ups battery"],hsn:"8507"},
    {keywords:["fan","exhaust fan","ceiling fan","table fan","wall fan","blower"],hsn:"8414"},
    {keywords:["ac","air conditioner","air conditioning","split ac","window ac","cassette ac"],hsn:"8415"},
    {keywords:["fridge","refrigerator","freezer","deep freezer","cold storage"],hsn:"8418"},
    {keywords:["geyser","water heater","immersion rod","electric iron","iron box"],hsn:"8516"},
    {keywords:["washing machine","washer","laundry machine","front load","top load"],hsn:"8450"},
    {keywords:["computer","laptop","desktop","server","pc","notebook","tablet","ipad"],hsn:"8471"},
    {keywords:["phone","mobile","smartphone","telephone","iphone","android"],hsn:"8517"},
    {keywords:["tv","television","led tv","lcd tv","monitor","display","screen","projector"],hsn:"8528"},
    {keywords:["cctv","camera","security camera","ip camera","dvr","nvr"],hsn:"8525"},
    {keywords:["valve","tap","cock","faucet","stopcock","ball valve","gate valve"],hsn:"8481"},
    {keywords:["generator","genset","dg set","diesel generator"],hsn:"8502"},
    // Vehicles
    {keywords:["car","vehicle","automobile","sedan","suv","hatchback","swift","alto","innova"],hsn:"8703"},
    {keywords:["truck","lorry","tempo","pickup","commercial vehicle","goods vehicle"],hsn:"8704"},
    {keywords:["bike","motorcycle","scooter","two wheeler","moped","activa","splendor","pulsar"],hsn:"8711"},
    // Medicine & Healthcare
    {keywords:["medicine","tablet","capsule","syrup","injection","drug","pharmaceutical","paracetamol","antibiotic"],hsn:"3004"},
    {keywords:["bandage","dressing","gauze","medical dressing"],hsn:"3005"},
    {keywords:["surgical instrument","medical instrument","stethoscope","bp machine","blood pressure"],hsn:"9018"},
    {keywords:["thermometer","temperature","pyrometer"],hsn:"9025"},
    // FMCG & Daily Use
    {keywords:["soap","bathing soap","toilet soap","dettol","lifebuoy","dove"],hsn:"3401"},
    {keywords:["detergent","washing powder","surf","ariel","vim","dishwash","cleaning agent"],hsn:"3402"},
    {keywords:["shampoo","hair oil","hair care","conditioner","hair gel"],hsn:"3305"},
    {keywords:["cream","face cream","moisturiser","lotion","cosmetic","skin care","fairness"],hsn:"3304"},
    {keywords:["insecticide","pesticide","hit","baygon","mosquito","cockroach","termite"],hsn:"3808"},
    // Food & Agriculture
    {keywords:["rice","basmati","parboiled rice","sona masoori"],hsn:"1006"},
    {keywords:["wheat","atta","whole wheat","wheat grain"],hsn:"1001"},
    {keywords:["flour","maida","suji","semolina","besan","gram flour"],hsn:"1102"},
    {keywords:["sugar","cane sugar","jaggery","gur"],hsn:"1701"},
    {keywords:["tea","chai","green tea","darjeeling tea","assam tea"],hsn:"0902"},
    {keywords:["milk","dairy","fresh milk"],hsn:"0401"},
    {keywords:["milk powder","condensed milk","skimmed milk","dairy powder"],hsn:"0402"},
    {keywords:["paneer","cheese","butter","ghee"],hsn:"0406"},
    {keywords:["egg","poultry egg","eggs"],hsn:"0407"},
    {keywords:["fish","salmon","rohu","katla","hilsa","seafood"],hsn:"0302"},
    {keywords:["onion","garlic","leek","shallot"],hsn:"0703"},
    {keywords:["potato","aloo"],hsn:"0701"},
    {keywords:["tomato","tamatar"],hsn:"0702"},
    // Fuel & Energy
    {keywords:["coal","lignite","coke","charcoal"],hsn:"2701"},
    {keywords:["petrol","diesel","petroleum","fuel","lubricant","lube oil","engine oil","mobil","castrol"],hsn:"2710"},
    // Textile
    {keywords:["cotton fabric","cotton cloth","cotton textile","saree fabric"],hsn:"5208"},
    {keywords:["synthetic fabric","polyester fabric","nylon fabric"],hsn:"5407"},
    {keywords:["shirt","tshirt","t-shirt","vest","top","polo shirt"],hsn:"6109"},
    {keywords:["trouser","pant","jeans","shorts","men wear","kurta pyjama"],hsn:"6203"},
    {keywords:["dress","saree","kurti","ladies wear","women wear","salwar"],hsn:"6204"},
    {keywords:["sack","jute bag","gunny bag","pp bag","woven bag"],hsn:"6305"},
    // Rubber & Tyres
    {keywords:["tyre","tire","tube","rubber tyre","vehicle tyre"],hsn:"4011"},
    {keywords:["rubber","synthetic rubber","latex","rubber sheet"],hsn:"4002"},
    // Paper
    {keywords:["paper","copier paper","a4 paper","printing paper","note paper"],hsn:"4802"},
    {keywords:["carton","cardboard box","packing box","corrugated box"],hsn:"4819"},
    {keywords:["book","textbook","printed book","novel","magazine"],hsn:"4901"},
    // Furniture
    {keywords:["furniture","sofa","couch","settee"],hsn:"9403"},
    {keywords:["chair","seat","office chair","stool","bench"],hsn:"9401"},
    {keywords:["mattress","pillow","cushion","sleeping bag","bed mattress","foam mattress"],hsn:"9404"},
    // Toys & Sports
    {keywords:["toy","game","doll","puzzle","board game","lego","action figure"],hsn:"9503"},
    {keywords:["sports","cricket bat","cricket","football","badminton","gym","dumbbell","treadmill"],hsn:"9506"},
    // Glass
    {keywords:["glass bottle","bottle","jar","glass container","glassware"],hsn:"7010"},
    // Misc
    {keywords:["diaper","sanitary pad","napkin","sanitary towel","pampers"],hsn:"9619"},
    {keywords:["salt","iodized salt","rock salt","table salt"],hsn:"2501"},
    // Services
    {keywords:["construction","civil work","building work","contractor","labour"],hsn:"9954"},
    {keywords:["it service","software","software development","web development","app development"],hsn:"9983"},
    {keywords:["transport","logistics","freight","courier","delivery"],hsn:"9985"},
    {keywords:["repair","maintenance","service charge","amc","annual maintenance"],hsn:"9987"},
    {keywords:["rent","rental","lease","hire"],hsn:"9973"},
  ];

  // AI HSN Code Lookup — product name → HSN + GST rate (LOCAL DATABASE)
  app.post("/api/hsn-lookup", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "query is required" });
      const q = query.toLowerCase().trim();
      // Try keyword map first
      for (const entry of KEYWORD_MAP) {
        if (entry.keywords.some(k => q.includes(k))) {
          const data = HSN_DB[entry.hsn];
          if (data) return res.json({ hsn: entry.hsn, ...data });
        }
      }
      // Try description match in DB
      for (const [hsn, data] of Object.entries(HSN_DB)) {
        if (data.description.toLowerCase().split(" ").some((w: string) => w.length > 3 && q.includes(w))) {
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

  // HSN Reverse Lookup — HSN code → product name + GST rate (LOCAL DATABASE)
  app.post("/api/hsn-reverse-lookup", async (req, res) => {
    try {
      const { hsn } = req.body;
      if (!hsn) return res.status(400).json({ error: "hsn is required" });
      const code = hsn.toString().trim().padStart(4, "0");
      // Exact match
      if (HSN_DB[code]) return res.json({ hsn: code, ...HSN_DB[code] });
      // 4-digit prefix match
      const code4 = code.substring(0, 4);
      if (HSN_DB[code4]) return res.json({ hsn: code4, ...HSN_DB[code4] });
      // 2-digit chapter match
      const code2 = code.substring(0, 2);
      for (const [h, data] of Object.entries(HSN_DB)) {
        if (h.startsWith(code2)) return res.json({ hsn: h, ...data });
      }
      return res.json({ hsn: code, description: "Goods", gstRate: 18, category: "goods" });
    } catch (error) {
      console.error("HSN reverse lookup error:", error);
      res.status(500).json({ error: "Failed to lookup HSN" });
    }
  });

  // GSTR-2B extraction — text paste OR image/PDF, uses Groq (free forever)
  app.post("/api/extract-gstr2b", async (req, res) => {
    try {
      const { text, imageBase64, mimeType } = req.body;
      if (!text && !imageBase64) return res.status(400).json({ error: "text or imageBase64 is required" });

      const PROMPT = `You are an expert at reading Indian GSTR-2B auto-drafted statements.
Extract ALL B2B invoice entries. Return ONLY a valid JSON array, no markdown, no explanation:
[{"supplierName":"","supplierGSTIN":"","invoiceNumber":"","invoiceDate":"DD/MM/YYYY","taxableAmount":0,"igst":0,"cgst":0,"sgst":0,"totalITC":0,"gstRate":0,"period":""}]
Rule: totalITC = igst + cgst + sgst. Use 0 for missing numbers, empty string for missing text.`;

      let responseText = "";
      if (imageBase64) {
        const chat = await groq.chat.completions.create({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: [
            { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
            { type: "text", text: PROMPT }
          ]}],
          max_tokens: 4000,
          temperature: 0.1,
        });
        responseText = chat.choices[0]?.message?.content || "";
      } else {
        const chat = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: PROMPT + "\n\nGSTR-2B DATA:\n" + text }],
          max_tokens: 4000,
          temperature: 0.1,
        });
        responseText = chat.choices[0]?.message?.content || "";
      }

      const clean = responseText.replace(/```json|```/g, "").trim();
      const jsonMatch = clean.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return res.status(422).json({ error: "Could not extract GSTR-2B data" });
      res.json(JSON.parse(jsonMatch[0]));
    } catch (error) {
      console.error("GSTR-2B extraction error:", error);
      res.status(500).json({ error: "Failed to extract GSTR-2B data", detail: String(error) });
    }
  });

  // PDF/Excel file extraction
  app.post("/api/extract-gstr2b-file", async (req, res) => {
    try {
      const { fileBase64, fileName, mimeType } = req.body;
      if (!fileBase64) return res.status(400).json({ error: "fileBase64 required" });
      const data = Buffer.from(fileBase64, "base64");
      let extractText = "";
      if ((mimeType && mimeType.includes("pdf")) || (fileName && fileName.endsWith(".pdf"))) {
        const pdfParse = (await import("pdf-parse")).default;
        const pdf = await pdfParse(data);
        extractText = pdf.text;
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(data, { type: "buffer" });
        wb.SheetNames.forEach((name) => {
          extractText += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + "\n";
        });
      }
      if (!extractText.trim()) return res.status(422).json({ error: "Could not read file content" });
      const PROMPT = "Extract ALL B2B invoice entries from this GSTR-2B data. Return ONLY a valid JSON array, no markdown: [{supplierName,supplierGSTIN,invoiceNumber,invoiceDate,taxableAmount,igst,cgst,sgst,totalITC,gstRate,period}]. totalITC=igst+cgst+sgst";
      const chat = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: PROMPT + "\n\nDATA:\n" + extractText.substring(0, 8000) }],
        max_tokens: 4000,
        temperature: 0.1,
      });
      const responseText = chat.choices[0]?.message?.content || "";
      const clean = responseText.replace(/```json|```/g, "").trim();
      const m = clean.match(/\[[\s\S]*\]/);
      if (!m) return res.status(422).json({ error: "Could not extract GSTR-2B data from file" });
      res.json(JSON.parse(m[0]));
    } catch (error) {
      console.error("File extract error:", error);
      res.status(500).json({ error: "Failed to extract from file", detail: String(error) });
    }
  });

  // Gmail OAuth - start
  app.get("/auth/google", (req, res) => {
    const { google } = require("googleapis");
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || "https://checkmygst2.onrender.com/auth/google/callback"
    );
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.readonly"],
      prompt: "consent",
    });
    res.redirect(url);
  });

  // Gmail OAuth - callback
  app.get("/auth/google/callback", async (req, res) => {
    const { google } = require("googleapis");
    const code = req.query.code;
    if (!code) return res.status(400).send("No code");
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "https://checkmygst2.onrender.com/auth/google/callback"
      );
      const { tokens } = await oauth2Client.getToken(code);
      (req as any).session.gmailTokens = tokens;
      res.send("<html><body><script>window.opener&&window.opener.postMessage({type:'GMAIL_AUTH_SUCCESS'},'*');window.close();</script><p>Gmail connected! Close this window.</p></body></html>");
    } catch (e) {
      console.error("OAuth error:", e);
      res.status(500).send("OAuth failed");
    }
  });

  // Gmail status
  app.get("/api/gmail/status", (req, res) => {
    res.json({ connected: !!(req as any).session?.gmailTokens });
  });

  // Gmail disconnect
  app.post("/api/gmail/disconnect", (req, res) => {
    if ((req as any).session) (req as any).session.gmailTokens = null;
    res.json({ success: true });
  });

  // Gmail search for GST emails
  app.get("/api/gmail/gst-emails", async (req, res) => {
    const tokens = (req as any).session?.gmailTokens;
    if (!tokens) return res.status(401).json({ error: "Gmail not connected" });
    try {
      const { google } = require("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const searchRes = await gmail.users.messages.list({
        userId: "me",
        q: 'from:noreply@gst.gov.in OR subject:"GSTR-2B" OR subject:"GST Return" OR subject:"Input Tax Credit"',
        maxResults: 20,
      });
      const messages = searchRes.data.messages || [];
      if (!messages.length) return res.json([]);
      const details = await Promise.all(messages.slice(0, 15).map(async (msg) => {
        const d = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "metadata", metadataHeaders: ["Subject","From","Date"] });
        const h = d.data.payload?.headers || [];
        const get = (n) => h.find((x) => x.name === n)?.value || "";
        return { id: msg.id, subject: get("Subject"), from: get("From"), date: get("Date"), hasAttachment: (d.data.payload?.parts||[]).some((p) => p.filename) };
      }));
      res.json(details);
    } catch (e) {
      console.error("Gmail search error:", e);
      res.status(500).json({ error: "Failed to search Gmail", detail: String(e) });
    }
  });

  // Extract GSTR-2B from Gmail email
  app.post("/api/gmail/extract-email", async (req, res) => {
    const tokens = (req as any).session?.gmailTokens;
    if (!tokens) return res.status(401).json({ error: "Gmail not connected" });
    const { emailId } = req.body;
    if (!emailId) return res.status(400).json({ error: "emailId required" });
    try {
      const { google } = require("googleapis");
      const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const detail = await gmail.users.messages.get({ userId: "me", id: emailId, format: "full" });
      const payload = detail.data.payload;
      const getBody = (part) => {
        if (part.body?.data) return Buffer.from(part.body.data, "base64").toString("utf-8");
        if (part.parts) return part.parts.map(getBody).join("\n");
        return "";
      };
      let extractText = getBody(payload);
      const parts = payload?.parts || [];
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          const att = await gmail.users.messages.attachments.get({ userId: "me", messageId: emailId, id: part.body.attachmentId });
          const data = Buffer.from(att.data.data || "", "base64");
          if (part.filename.endsWith(".pdf")) {
            const pdfParse = (await import("pdf-parse")).default;
            const pdf = await pdfParse(data);
            extractText += "\n" + pdf.text;
          } else if (part.filename.endsWith(".xlsx") || part.filename.endsWith(".xls")) {
            const XLSX = await import("xlsx");
            const wb = XLSX.read(data, { type: "buffer" });
            wb.SheetNames.forEach((name) => { extractText += "\n" + XLSX.utils.sheet_to_csv(wb.Sheets[name]); });
          }
        }
      }
      if (!extractText.trim()) return res.status(422).json({ error: "Could not extract text from email" });
      const PROMPT = "Extract ALL B2B invoice entries from this GSTR-2B email. Return ONLY a valid JSON array, no markdown: [{supplierName,supplierGSTIN,invoiceNumber,invoiceDate,taxableAmount,igst,cgst,sgst,totalITC,gstRate,period}]. totalITC=igst+cgst+sgst";
      const chat = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: PROMPT + "\n\nDATA:\n" + extractText.substring(0, 8000) }],
        max_tokens: 4000,
        temperature: 0.1,
      });
      const responseText = chat.choices[0]?.message?.content || "";
      const clean = responseText.replace(/```json|```/g, "").trim();
      const m = clean.match(/\[[\s\S]*\]/);
      if (!m) return res.status(422).json({ error: "Could not extract invoice data from email" });
      res.json(JSON.parse(m[0]));
    } catch (e) {
      console.error("Gmail extract error:", e);
      res.status(500).json({ error: "Failed to extract from email", detail: String(e) });
    }
  });


  // ── Email Reminders via Resend ──
  app.post("/api/send-reminder", async (req, res) => {
    try {
      const { email, businessName, gstin, reminders } = req.body;
      if (!email || !reminders?.length) return res.status(400).json({ error: "email and reminders required" });

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const rows = reminders.map((r: any) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${r.returnType}</td>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6">${r.period}</td>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6">${r.dueDate}</td>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6;color:${r.daysLeft <= 3 ? '#dc2626' : '#d97706'};font-weight:700">${r.daysLeft} days left</td>
        </tr>`).join("");

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:0;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;margin-top:24px">
    <div style="background:#1d4ed8;padding:28px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px">GST Filing Reminder</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0">${businessName || "Your Business"} ${gstin ? "· " + gstin : ""}</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#374151;font-size:15px;margin-top:0">You have upcoming GST filing deadlines. File on time to avoid penalties.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#eff6ff">
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Return</th>
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Period</th>
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Due Date</th>
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Status</th>
        </tr>
        ${rows}
      </table>
      <div style="background:#fef2f2;border-radius:10px;padding:14px;margin:20px 0;border-left:4px solid #dc2626">
        <p style="margin:0;color:#dc2626;font-size:13px;font-weight:600">⚠️ Late filing penalty: ₹50/day for GSTR-1 and GSTR-3B (max ₹10,000)</p>
      </div>
      <a href="https://checkmygst2.onrender.com" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px">Open CheckMyGST →</a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">Sent by CheckMyGST · You can disable reminders in the app settings.</div>
  </div>
</body>
</html>`;

      await resend.emails.send({
        from: "CheckMyGST <reminders@checkmygst.in>",
        to: email,
        subject: `⏰ GST Filing Due in ${reminders[0]?.daysLeft} days — ${reminders[0]?.returnType} for ${reminders[0]?.period}`,
        html,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Email reminder error:", error);
      res.status(500).json({ error: "Failed to send reminder", detail: String(error) });
    }
  });


  // ── Email Reminders via Resend ──
  app.post("/api/send-reminder", async (req, res) => {
    try {
      const { email, businessName, gstin, reminders } = req.body;
      if (!email || !reminders?.length) return res.status(400).json({ error: "email and reminders required" });

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const rows = reminders.map((r: any) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600">${r.returnType}</td>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6">${r.period}</td>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6">${r.dueDate}</td>
          <td style="padding:10px;border-bottom:1px solid #f3f4f6;color:${r.daysLeft <= 3 ? '#dc2626' : '#d97706'};font-weight:700">${r.daysLeft} days left</td>
        </tr>`).join("");

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:0;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;margin-top:24px">
    <div style="background:#1d4ed8;padding:28px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px">GST Filing Reminder</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0">${businessName || "Your Business"} ${gstin ? "· " + gstin : ""}</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#374151;font-size:15px;margin-top:0">You have upcoming GST filing deadlines. File on time to avoid penalties.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#eff6ff">
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Return</th>
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Period</th>
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Due Date</th>
          <th style="padding:10px;text-align:left;font-size:13px;color:#1d4ed8">Status</th>
        </tr>
        ${rows}
      </table>
      <div style="background:#fef2f2;border-radius:10px;padding:14px;margin:20px 0;border-left:4px solid #dc2626">
        <p style="margin:0;color:#dc2626;font-size:13px;font-weight:600">⚠️ Late filing penalty: ₹50/day for GSTR-1 and GSTR-3B (max ₹10,000)</p>
      </div>
      <a href="https://checkmygst2.onrender.com" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px">Open CheckMyGST →</a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">Sent by CheckMyGST · You can disable reminders in the app settings.</div>
  </div>
</body>
</html>`;

      await resend.emails.send({
        from: "CheckMyGST <reminders@checkmygst.in>",
        to: email,
        subject: `⏰ GST Filing Due in ${reminders[0]?.daysLeft} days — ${reminders[0]?.returnType} for ${reminders[0]?.period}`,
        html,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Email reminder error:", error);
      res.status(500).json({ error: "Failed to send reminder", detail: String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
} 
