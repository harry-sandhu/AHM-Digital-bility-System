import { Response } from "express";
import Bilty from "../models/bilty";
import BiltyCounter from "../models/BiltyCounter";
import { AuthRequest } from "../middleware/auth";

const canManageAllBilties = (role?: string) =>
  role === "superadmin" || role === "admin";

export const generateBilty = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const prefix = `AHM-${new Date().getFullYear()}`;

    const counter = await BiltyCounter.findOneAndUpdate(
      { prefix },
      { $inc: { counter: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const biltyNumber = `${prefix}-${String(counter.counter).padStart(4, "0")}`;

    const bilty = await Bilty.create({
      biltyNumber,
      createdBy: req.user._id,
      formData: {},
    });

    res.status(201).json({
      message: "Bilty reserved",
      biltyId: bilty._id,
      biltyNumber,
    });
  } catch {
    res.status(500).json({ error: "Failed to generate bilty number" });
  }
};

export const updateBilty = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const biltyId = req.params.id;
    const formData = req.body.formData;

    const bilty = await Bilty.findById(biltyId);
    if (!bilty) {
      return res.status(404).json({ error: "Bilty not found" });
    }

    if (
      String(bilty.createdBy) !== String(req.user._id) &&
      !canManageAllBilties(req.user.role)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    bilty.formData = formData;
    await bilty.save();

    const populatedBilty = await Bilty.findById(bilty._id).populate(
      "createdBy",
      "name phone role"
    );

    res.json({
      message: "Bilty updated successfully",
      bilty: populatedBilty,
    });
  } catch {
    res.status(500).json({ error: "Failed to update bilty" });
  }
};

export const getMyBilty = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const biltys = await Bilty.find({ createdBy: req.user._id })
      .populate("createdBy", "name phone role")
      .sort({ createdAt: -1 });

    res.status(200).json(biltys);
  } catch {
    res.status(500).json({ error: "Failed to fetch bilty records" });
  }
};

export const getAllBilty = async (req: AuthRequest, res: Response) => {
  try {
    const biltys = await Bilty.find()
      .populate("createdBy", "name phone role")
      .sort({ createdAt: -1 });

    res.status(200).json(biltys);
  } catch {
    res.status(500).json({ error: "Failed to fetch bilty records" });
  }
};
