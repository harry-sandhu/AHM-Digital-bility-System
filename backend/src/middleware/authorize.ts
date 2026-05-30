import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import type { Role } from "../utils/types";

const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role as Role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
};

export default authorize;
