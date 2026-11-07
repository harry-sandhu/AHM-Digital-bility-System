import type { Request, Response } from "express";
import app, { connectDatabase } from "../src/server";

export default async function handler(req: Request, res: Response) {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (_error) {
    return res.status(503).json({ error: "Database unavailable" });
  }
}
