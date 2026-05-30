import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../models/User";
import { verifyToken } from "../utils/tokenUtils";

interface TokenPayload {
  id: string;
}

export interface AuthRequest extends Request {
  user?: IUser;
}

export default async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = verifyToken(token) as TokenPayload;
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account has been disabled" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
