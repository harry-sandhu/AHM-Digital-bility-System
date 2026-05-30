import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1, name: 1 });

    res.json(users);
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const createAdmin = async (req: Request, res: Response) => {
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

    const admin = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    res.status(201).json({
      message: "Admin created successfully",
      user: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
        isActive: admin.isActive,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to create admin" });
  }
};

export const disableUser = async (req: Request, res: Response) => {
  try {
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.role !== "user") {
      return res
        .status(400)
        .json({ error: "Only normal users can be disabled" });
    }

    if (!targetUser.isActive) {
      return res.status(400).json({ error: "User is already disabled" });
    }

    targetUser.isActive = false;
    await targetUser.save();

    res.json({ message: "User disabled successfully" });
  } catch {
    res.status(500).json({ error: "Failed to disable user" });
  }
};
