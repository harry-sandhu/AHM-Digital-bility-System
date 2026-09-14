import { Response } from "express";
import Bilty from "../models/bilty";
import BiltyCounter from "../models/BiltyCounter";
import NumberRange from "../models/NumberRange";
import User from "../models/User";
import { AuthRequest } from "../middleware/auth";
import {
  allocateConsignmentNumber,
  NO_CONSIGNMENT_NUMBERS_ERROR,
  resetRangeToFirstAvailable,
} from "../utils/numberRange";
import { getBiltyAccessAmount } from "../utils/biltyPricing";

const canManageAllBilties = (role?: string) =>
  role === "superadmin";

const DEFAULT_BILTY_ACCESS_AMOUNT = 200;

const parseAmount = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const getIndianMidnightDeadline = (fromDate = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fromDate);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value;
  const indianDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

  return new Date(`${indianDate}T23:59:59.999+05:30`);
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
  biltyAccessFreightAmount?: number | null;
}) => ({
  biltyAccessPaidAt: user.biltyAccessPaidAt
    ? new Date(user.biltyAccessPaidAt).toISOString()
    : null,
  biltyAccessExpiresAt: user.biltyAccessExpiresAt
    ? new Date(user.biltyAccessExpiresAt).toISOString()
    : null,
  biltyAccessAmount:
    typeof user.biltyAccessAmount === "number" ? user.biltyAccessAmount : 0,
  biltyAccessFreightAmount:
    typeof user.biltyAccessFreightAmount === "number"
      ? user.biltyAccessFreightAmount
      : null,
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

    let consignmentNo: number;

    try {
      consignmentNo = await allocateConsignmentNumber(req.user._id);
    } catch (error) {
      if (error instanceof Error && error.message === NO_CONSIGNMENT_NUMBERS_ERROR) {
        return res.status(409).json({ error: NO_CONSIGNMENT_NUMBERS_ERROR });
      }

      throw error;
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
      : getIndianMidnightDeadline();

    const bilty = await Bilty.create({
      biltyNumber,
      consignmentNo,
      createdBy: req.user._id,
      formData: {},
      status: getBiltyStatus(expiresAt),
      paymentAmount: req.user.biltyAccessAmount || DEFAULT_BILTY_ACCESS_AMOUNT,
      paymentPaidAt: req.user.biltyAccessPaidAt || new Date(),
      paymentExpiresAt: expiresAt,
      expiresAt,
    });

    res.status(201).json({
      message: "Bilty reserved",
      biltyId: bilty._id,
      biltyNumber,
      consignmentNo,
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
    const freightAmount = Number(req.body?.freightAmount);

    if (!Number.isFinite(freightAmount) || freightAmount <= 0) {
      return res.status(400).json({
        error: "A valid freight amount greater than zero is required",
      });
    }

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

    const hasExistingAccess = Boolean(
      existingExpiry && existingExpiry.getTime() >= now.getTime()
    );
    const expiresAt = hasExistingAccess && existingExpiry
      ? existingExpiry
      : getIndianMidnightDeadline(now);
    const biltyAccessAmount = getBiltyAccessAmount(freightAmount);

    if (!hasExistingAccess) {
      user.biltyAccessPaidAt = now;
    }
    user.biltyAccessExpiresAt = expiresAt;
    user.biltyAccessAmount = biltyAccessAmount;
    user.biltyAccessFreightAmount = freightAmount;
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

    const isExpired = Boolean(bilty.expiresAt && isPastDeadline(bilty.expiresAt));

    if (isExpired && req.user.role !== "superadmin") {
      if (bilty.status !== "expired") {
        bilty.status = "expired";
        await bilty.save();
      }

      return res.status(410).json({
        error: "Bilty expired. Please create a new bilty after paying again.",
      });
    }

    const isOwner = String(bilty.createdBy) === String(req.user._id);
    const nextFormData: Record<string, unknown> = {
      ...(formData && typeof formData === "object" ? formData : {}),
      consignmentNo: String(bilty.consignmentNo ?? ""),
      gstPaidBy:
        typeof formData?.gstPaidBy === "string" && formData.gstPaidBy
          ? formData.gstPaidBy
          : "Consignor",
      basisOfBooking:
        typeof formData?.basisOfBooking === "string" && formData.basisOfBooking
          ? formData.basisOfBooking
          : "To Pay",
    };

    if (isOwner && typeof req.user.biltyAccessFreightAmount === "number") {
      nextFormData.freight = String(req.user.biltyAccessFreightAmount);
    }

    const grandTotal =
      parseAmount(nextFormData.freight) +
      parseAmount(nextFormData.labour) +
      parseAmount(nextFormData.gstCharges) +
      parseAmount(nextFormData.biltyCharges) +
      parseAmount(nextFormData.kanta);
    nextFormData.grandTotal = formatAmount(grandTotal);
    nextFormData.balanceAmt = formatAmount(
      grandTotal - parseAmount(nextFormData.advance)
    );

    bilty.formData = nextFormData;
    bilty.status = isExpired ? "expired" : "draft";
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

export const getBiltyById = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const bilty = await Bilty.findById(req.params.id).populate(
      "createdBy",
      "name phone role"
    );

    if (!bilty) {
      return res.status(404).json({ error: "Bilty not found" });
    }

    if (
      String(bilty.createdBy?._id || bilty.createdBy) !== String(req.user._id) &&
      !canManageAllBilties(req.user.role)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      ...bilty.toObject(),
      status:
        bilty.expiresAt && isPastDeadline(bilty.expiresAt)
          ? "expired"
          : bilty.status || "draft",
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch bilty" });
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

export const deleteBilty = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  try {
    const bilty = await Bilty.findByIdAndDelete(req.params.id);

    if (!bilty) {
      return res.status(404).json({ error: "Bilty not found" });
    }

    const deletedConsignmentNo = bilty.consignmentNo;
    const deletedOwner = bilty.createdBy;

    if (typeof deletedConsignmentNo === "number") {
      const range = await NumberRange.findOne({
        rangeStart: { $lte: deletedConsignmentNo },
        rangeEnd: { $gte: deletedConsignmentNo },
        $or: [
          { scope: "master" },
          { scope: "personal", userId: deletedOwner },
        ],
      });

      if (range) {
        await resetRangeToFirstAvailable(range._id);
      }
    }

    return res.json({ message: "Bilty deleted successfully" });
  } catch {
    return res.status(500).json({ error: "Failed to delete bilty" });
  }
};
