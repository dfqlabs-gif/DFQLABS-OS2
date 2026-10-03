import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "dfqlabs-os2", timestamp: new Date().toISOString() });
  });

  app.use((_req, res) => res.status(404).json({ type: "https://httpstatuses.com/404", title: "Not Found", status: 404 }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ error }, "Unhandled request error");
    res.status(500).json({ type: "https://httpstatuses.com/500", title: "Internal Server Error", status: 500 });
  });
  return app;
}
