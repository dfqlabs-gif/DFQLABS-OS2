import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class AuthController {
  public static login(req: Request, res: Response): void {
    const { email } = req.body;
    const user = LeadService.getUserByEmail(email);

    if (!user) {
      res.status(401).json({
        type: "https://dfqlabs.com/errors/invalid-credentials",
        title: "Invalid Credentials",
        status: 401,
        detail: "No active account found for given email"
      });
      return;
    }

    const token = user.role === "FOUNDER" ? "founder-token" : "specialist-token";
    const seat = LeadService.getSeatByUserId(user.id);

    res.status(200).json({
      token,
      user,
      seat
    });
  }

  public static me(req: Request, res: Response): void {
    if (!req.user) {
      res.status(401).json({
        type: "https://dfqlabs.com/errors/unauthorized",
        title: "Unauthorized",
        status: 401
      });
      return;
    }

    res.status(200).json({
      user: req.user,
      seat: req.seat
    });
  }
}
