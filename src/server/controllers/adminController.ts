import { Request, Response } from "express";
import { LeadService } from "../services/leadService.js";

export class AdminController {
  public static getTeam(_req: Request, res: Response): void {
    const users = LeadService.getUsers();
    const seats = LeadService.getSeats();
    res.status(200).json({ users, seats });
  }

  public static reassignSeat(req: Request, res: Response): void {
    const { seatId, newUserId } = req.body;
    try {
      const seat = LeadService.reassignSeat(seatId, newUserId);
      res.status(200).json({ seat });
    } catch (error) {
      res.status(400).json({
        type: "https://dfqlabs.com/errors/bad-request",
        title: "Seat Reassignment Failed",
        status: 400,
        detail: (error as Error).message
      });
    }
  }
}
