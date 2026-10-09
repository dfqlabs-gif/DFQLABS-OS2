import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { isSupabaseConnected } from "./config/supabase.js";
import { errorHandler } from "./middleware/errorHandler.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import focusRoutes from "./routes/focus.js";
import messageRoutes from "./routes/messages.js";
import outcomeRoutes from "./routes/outcomes.js";
import prospectRoutes from "./routes/prospects.js";
import leadFinderRoutes from "./routes/leadFinder.js";

// Never write credentials or session material into Render request logs.
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "req.headers['x-api-key']",
      "req.headers['X-API-KEY']",
      "res.headers['set-cookie']"
    ],
    censor: "[REDACTED]"
  }
});

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  app.get("/health", async (_req, res) => {
    const dbReady = await isSupabaseConnected();
    res.status(200).json({
      ok: true,
      service: "dfqlabs-os2",
      dbConnected: dbReady,
      timestamp: new Date().toISOString()
    });
  });

  // API v1 Routes
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/prospects", prospectRoutes);
  app.use("/api/v1/lead-finder", leadFinderRoutes);
  app.use("/api/v1/messages", messageRoutes);
  app.use("/api/v1/focus", focusRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/outcomes", outcomeRoutes);
  app.use("/api/v1/admin", adminRoutes);

  // Serve the compiled React application in production. API routes above remain authoritative.
  const clientDist = path.resolve(process.cwd(), "dist/client");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));

    app.get("*", (req, res, next) => {
      if (!req.accepts("html") || req.path.startsWith("/api/")) {
        return next();
      }
      return res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({
      type: "https://httpstatuses.com/404",
      title: "Not Found",
      status: 404
    });
  });

  app.use(errorHandler);

  return app;
}
