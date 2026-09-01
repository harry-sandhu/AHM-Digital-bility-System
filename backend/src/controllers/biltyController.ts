import { Response } from "express";
import Bilty from "../models/bilty";
import BiltyCounter from "../models/BiltyCounter";
import User from "../models/User";
import { AuthRequest } from "../middleware/auth";

const canManageAllBilties = (role?: string) =>
  role === "superadmin" || role === "admin";

const BILTY_ACCESS_AMOUNT = 300;

const getLocalMidnightDeadline = (fromDate = new Date()) => {
  const deadline = new Date(fromDate);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

const isPastDeadline = (deadline?: Date | string | null) => {
  if (!deadline) {
    return true;
  }

  return new Date(deadline).getTime() < Date.now();
};

const serializeBiltyAccess = (user: {
  biltyAccessPaidAt?: Date | string | null;
  biltyAccessExpiresAt?: Date | string | null;
  biltyAccessAmount?: number | null;
}) => ({
  biltyAccessPaidAt: user.biltyAccessPaidAt
    ? new Date(user.biltyAccessPaidAt).toISOString()
    : null,
  biltyAccessExpiresAt: user.biltyAccessExpiresAt
    ? new Date(user.biltyAccessExpiresAt).toISOString()
    : null,
  biltyAccessAmount:
    typeof user.biltyAccessAmount === "number" ? user.biltyAccessAmount : 0,
});

const getBiltyStatus = (expiresAt?: Date | string | null) =>
  expiresAt && !isPastDeadline(expiresAt) ? "draft" : "expired";

export const generateBilty = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    if (isPastDeadline(req.user.biltyAccessExpiresAt)) {
      return res.status(402).json({
        error: "Payment required before bilty generation",
      });
    }

    const activeBilty = await Bilty.findOne({
      createdBy: req.user._id,
      expiresAt: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    if (activeBilty) {
      return res.status(200).json({
        message: "Bilty already reserved",
        biltyId: activeBilty._id,
        biltyNumber: activeBilty.biltyNumber,
        expiresAt: activeBilty.expiresAt,
        paymentAmount:
          activeBilty.paymentAmount || req.user.biltyAccessAmount || BILTY_ACCESS_AMOUNT,
      });
    }

    const prefix = `AHM-${new Date().getFullYear()}`;

    const counter = await BiltyCounter.findOneAndUpdate(
      { prefix },
      { $inc: { counter: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const biltyNumber = `${prefix}-${String(counter.counter).padStart(4, "0")}`;
    const expiresAt = req.user.biltyAccessExpiresAt
      ? new Date(req.user.biltyAccessExpiresAt)
      : getLocalMidnightDeadline();

    const bilty = await Bilty.create({
      biltyNumber,
      createdBy: req.user._id,
      formData: {},
      status: getBiltyStatus(expiresAt),
      paymentAmount: req.user.biltyAccessAmount || BILTY_ACCESS_AMOUNT,
      paymentPaidAt: req.user.biltyAccessPaidAt || new Date(),
      paymentExpiresAt: expiresAt,
      expiresAt,
    });

    res.status(201).json({
      message: "Bilty reserved",
      biltyId: bilty._id,
      biltyNumber,
      expiresAt,
      paymentAmount: bilty.paymentAmount,
    });
  } catch {
    res.status(500).json({ error: "Failed to generate bilty number" });
  }
};

export const purchaseBiltyAccess = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account has been disabled" });
    }

    const now = new Date();
    const existingExpiry = user.biltyAccessExpiresAt
      ? new Date(user.biltyAccessExpiresAt)
      : null;

    if (existingExpiry && existingExpiry.getTime() >= now.getTime()) {
      return res.status(200).json({
        message: "Bilty access is already active",
        user: {
          id: String(user._id),
          name: user.name,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          ...serializeBiltyAccess(user),
        },
      });
    }

    const expiresAt = getLocalMidnightDeadline(now);

    user.biltyAccessPaidAt = now;
    user.biltyAccessExpiresAt = expiresAt;
    user.biltyAccessAmount = BILTY_ACCESS_AMOUNT;
    await user.save();

    res.status(200).json({
      message: "Bilty access activated",
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        ...serializeBiltyAccess(user),
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to activate bilty access" });
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

    if (bilty.expiresAt && isPastDeadline(bilty.expiresAt)) {
      if (bilty.status !== "expired") {
        bilty.status = "expired";
        await bilty.save();
      }

      return res.status(410).json({
        error: "Bilty expired. Please create a new bilty after paying again.",
      });
    }

    bilty.formData = formData;
    bilty.status = "draft";
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

    res.status(200).json(
      biltys.map((bilty) => ({
        ...bilty.toObject(),
        status:
          bilty.expiresAt && isPastDeadline(bilty.expiresAt)
            ? "expired"
            : bilty.status || "draft",
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch bilty records" });
  }
};

export const getAllBilty = async (req: AuthRequest, res: Response) => {
  try {
    const biltys = await Bilty.find()
      .populate("createdBy", "name phone role")
      .sort({ createdAt: -1 });

    res.status(200).json(
      biltys.map((bilty) => ({
        ...bilty.toObject(),
        status:
          bilty.expiresAt && isPastDeadline(bilty.expiresAt)
            ? "expired"
            : bilty.status || "draft",
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch bilty records" });
  }
};
