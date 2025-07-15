import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";

export const register = async (req: Request, res: Response) => {
  const { name, phone, password, role } = req.body;
  try {
    const existing = await User.findOne({ phone });
    if (existing)
      return res.status(400).json({ error: "Phone already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, phone, password: hashed, role });
    await user.save();

    res.status(201).json({ message: "User registered" });
  } catch {
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { phone, password } = req.body;
  try {
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ error: "Invalid phone" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
};
