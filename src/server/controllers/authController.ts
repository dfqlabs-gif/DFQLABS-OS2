import { Request, Response } from "express";
import { authenticateCredentials } from "../services/authService.js";
import { LeadService } from "../services/leadService.js";

export class AuthController {
  public static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const result = await authenticateCredentials(email, password);
    if (!result) {
      res.status(401).json({
        type: "https://dfqlabs.com/errors/invalid-credentials",
        title: "Invalid Credentials",
        status: 401,
        detail: "Invalid email or password"
      });
      return;
    }
    res.status(200).json({ token: result.token, user: result.user, seat: await LeadService.getSeatByUserIdAsync(result.user.id) });
  }

  public static async me(req: Request, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ type: "https://dfqlabs.com/errors/unauthorized", title: "Unauthorized", status: 401 }); return; }
    res.status(200).json({ user: req.user, seat: req.seat });
  }
}
