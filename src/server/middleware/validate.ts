import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const invalidParams = result.error.errors.map((e) => ({
        name: e.path.join("."),
        reason: e.message
      }));

      res.status(400).json({
        type: "https://dfqlabs.com/errors/invalid-payload",
        title: "Invalid Request Payload",
        status: 400,
        detail: "One or more request parameters failed validation",
        invalidParams
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
