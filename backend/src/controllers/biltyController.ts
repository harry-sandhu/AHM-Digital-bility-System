import { Request, Response } from "express";
import Bilty from "../models/bilty";
import BiltyCounter from "../models/BiltyCounter";
import { AuthRequest } from "../middleware/auth";

export const generateBilty = async (req: AuthRequest, res: Response) => {
  try {
    const prefix = "AHM-2025";
    let counter = await BiltyCounter.findOne({ prefix });

    if (!counter) {
      counter = new BiltyCounter({ prefix, counter: 1 });
    }

    const biltyNumber = `${prefix}-${String(counter.counter).padStart(4, "0")}`;
    counter.counter += 1;
    await counter.save();

    const bilty = new Bilty({
      biltyNumber,
      createdBy: req.user._id,
    });

    await bilty.save();

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
  try {
    const biltyId = req.params.id;
    const formData = req.body.formData;

    const bilty = await Bilty.findById(biltyId);
    if (!bilty) return res.status(404).json({ error: "Bilty not found" });

    if (
      String(bilty.createdBy) !== String(req.user._id) &&
      req.user.role !== "superadmin"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    bilty.formData = formData;
    await bilty.save();

    res.json({ message: "Bilty updated successfully", bilty });
  } catch {
    res.status(500).json({ error: "Failed to update bilty" });
  }
};

// GET /api/bilty/all
export const getAllBilty = async (req: AuthRequest, res: Response) => {
  try {
    let biltys;
    if (req.user.role === "superadmin") {
      biltys = await Bilty.find();
    } else {
      biltys = await Bilty.find({ createdBy: req.user._id });
    }
    res.status(200).json(biltys);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bilty records" });
  }
};
