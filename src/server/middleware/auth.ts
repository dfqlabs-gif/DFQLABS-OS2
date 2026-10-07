/* eslint-disable @typescript-eslint/no-namespace */
import { NextFunction, Request, Response } from "express";
import { OutreachSeat, User } from "../../shared/types/index.js";
import { LeadService } from "../services/leadService.js";
import { userIdFromToken } from "../services/authService.js";

declare global {
  namespace Express {
    interface Request { user?: User; seat?: OutreachSeat; }
  }
}

export async function authenticateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) { res.status(401).json({ title: "Unauthorized", status: 401, detail: "Authentication required" }); return; }

  const userId = userIdFromToken(token);
  if (!userId) { res.status(401).json({ title: "Unauthorized", status: 401, detail: "Invalid or expired session" }); return; }

  const user = await LeadService.getUserByIdAsync(userId);
  if (!user || !user.isActive) { res.status(401).json({ title: "Unauthorized", status: 401, detail: "Account unavailable" }); return; }

  req.user = user;
  req.seat = (await LeadService.getSeatByUserIdAsync(user.id)) ?? undefined;
  next();
}
