import jwt, { SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but was not set.");
}

const JWT_SECRET = process.env.JWT_SECRET;

export const signToken = (
  payload: object,
  expiresIn: SignOptions["expiresIn"] = "7d"
) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};
