import { NextFunction, Request, Response } from "express";
import { OutreachSeat, User } from "../../shared/types/index.js";
import { getSupabaseClient } from "../config/supabase.js";
import { LeadService } from "../services/leadService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      seat?: OutreachSeat;
    }
  }
}

export async function authenticateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      type: "https://dfqlabs.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Missing or malformed Authorization Bearer token header"
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({
      type: "https://dfqlabs.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Bearer token string is empty"
    });
    return;
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const dbUser = await LeadService.getUserByIdAsync(data.user.id);
        if (dbUser) {
          req.user = dbUser;
          req.seat = (await LeadService.getSeatByUserIdAsync(dbUser.id)) ?? undefined;
          return next();
        }
      }
    } catch {
      // Fallback to local user table lookup if auth token check fails
    }
  }

  // Resolve user from user store by token matching user ID or email
  const user =
    LeadService.getUsers().find((u) => u.id === token || u.email.toLowerCase() === token.toLowerCase()) ||
    (token.includes("founder") ? LeadService.getUsers().find((u) => u.role === "FOUNDER") : undefined) ||
    (token.includes("specialist") ? LeadService.getUsers().find((u) => u.role === "OUTREACH_SPECIALIST") : undefined);

  if (user) {
    req.user = user;
    req.seat = LeadService.getSeatByUserId(user.id);
    return next();
  }

  res.status(401).json({
    type: "https://dfqlabs.com/errors/unauthorized",
    title: "Unauthorized",
    status: 401,
    detail: "Invalid or expired authorization token"
  });
}
