import { NextFunction, Request, Response } from "express";
import { UserRole } from "../../shared/types/index.js";

export function requireRole(allowedRoles: UserRole | UserRole[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        type: "https://dfqlabs.com/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "User context missing"
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        type: "https://dfqlabs.com/errors/forbidden",
        title: "Forbidden",
        status: 403,
        detail: `Action requires one of the following roles: ${roles.join(", ")}`
      });
      return;
    }

    next();
  };
}
