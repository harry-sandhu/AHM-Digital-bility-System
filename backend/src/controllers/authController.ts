import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import { signToken } from "../utils/tokenUtils";

const sanitizeUser = (user: {
  _id: unknown;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
}) => ({
  id: String(user._id),
  name: user.name,
  phone: user.phone,
  role: user.role,
  isActive: user.isActive,
});

export const register = async (req: Request, res: Response) => {
  const { name, phone, password } = req.body as {
    name?: string;
    phone?: string;
    password?: string;
  };

  if (!name || !phone || !password) {
    return res
      .status(400)
      .json({ error: "Name, phone and password are required" });
  }

  try {
    const existing = await User.findOne({ phone: phone.trim() });
    if (existing) {
      return res.status(400).json({ error: "Phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: "user",
      isActive: true,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: sanitizeUser(user),
    });
  } catch {
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { phone, password } = req.body as {
    phone?: string;
    password?: string;
  };

  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password are required" });
  }

  try {
    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      return res.status(400).json({ error: "Invalid phone or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account has been disabled" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid phone or password" });
    }

    const token = signToken({ id: user._id });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
};
