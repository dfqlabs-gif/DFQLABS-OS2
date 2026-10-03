import { NextFunction, Request, Response } from "express";

export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  code?: string;
  detail?: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  console.error("API Error:", error);

  if (res.headersSent) {
    return;
  }

  const problem: ApiProblemDetails = {
    type: "https://dfqlabs.com/errors/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail: error instanceof Error ? error.message : "An unexpected error occurred",
    instance: req.originalUrl
  };

  res.status(500).json(problem);
}
