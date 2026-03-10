import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header("origin") || "";
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    });
    next();
  });
}

function serveStaticApp(app: express.Application) {
  const staticPath = path.resolve(process.cwd(), "static-build", "web");

  if (fs.existsSync(staticPath)) {
    log(`Serving static build from: ${staticPath}`);
    app.use(express.static(staticPath));

    app.use((req: Request, res: Response) => {
      if (req.path.startsWith("/api")) return;
      const indexPath = path.join(staticPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build not found.");
      }
    });
  } else {
    app.use((req: Request, res: Response) => {
      if (req.path.startsWith("/api")) return;
      const indexPath = path.join(staticPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build not found.");
      }
    });
```

6. Scroll to the bottom of the page
7. You will see a green **"Commit changes"** button — click it
8. A popup appears — click **"Commit directly to main"** → click green **"Commit changes"**
9. The page reloads — you should see **"2 minutes ago"** or similar next to the file name — that confirms it saved

---

**Step 3 — Check the commit changed**

Go to:
```
github.com/samantaraunakin-sudo/CHECKMYGST2/commits/main
      res.json({ status: "CheckMyGST API running" });
    });
  }
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as { status?: number; statusCode?: number; message?: string };
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
    log(`✅ CheckMyGST server running on port ${port}`);
  });
})();
