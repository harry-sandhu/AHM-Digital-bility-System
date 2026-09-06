import { Request, Response } from "express";
import { Types } from "mongoose";
import NumberRange from "../models/NumberRange";
import User from "../models/User";
import { AuthRequest } from "../middleware/auth";

const isValidInteger = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value);

const validateBounds = (rangeStart: unknown, rangeEnd: unknown) => {
  if (!isValidInteger(rangeStart) || !isValidInteger(rangeEnd)) {
    return "Range start and end must be integers";
  }

  if ((rangeStart as number) < 1000 || (rangeEnd as number) < 1000) {
    return "Range values must be at least 1000";
  }

  if ((rangeStart as number) > (rangeEnd as number)) {
    return "Range start cannot be greater than range end";
  }

  return null;
};

const findOverlap = (rangeStart: number, rangeEnd: number, excludeId?: string) =>
  NumberRange.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    isActive: true,
    rangeStart: { $lte: rangeEnd },
    rangeEnd: { $gte: rangeStart },
  });

const serializeRange = (range: any) => ({
  ...range.toObject(),
  remaining: Math.max(0, range.rangeEnd - range.nextNumber + 1),
});

export const createRange = async (req: AuthRequest, res: Response) => {
  const {
    label,
    scope,
    userId,
    rangeStart,
    rangeEnd,
  } = req.body as Record<string, unknown>;

  const boundsError = validateBounds(rangeStart, rangeEnd);
  if (boundsError) {
    return res.status(400).json({ error: boundsError });
  }

  if (scope !== "master" && scope !== "personal") {
    return res.status(400).json({ error: "Scope must be master or personal" });
  }

  if (scope === "personal" && (!userId || !Types.ObjectId.isValid(String(userId)))) {
    return res.status(400).json({ error: "A valid user is required for a personal range" });
  }

  try {
    if (scope === "personal") {
      const assignedUser = await User.exists({ _id: userId });
      if (!assignedUser) {
        return res.status(400).json({ error: "Assigned user was not found" });
      }

      const existingPersonal = await NumberRange.findOne({
        scope: "personal",
        userId,
        isActive: true,
        isExhausted: false,
      });

      if (existingPersonal) {
        return res.status(400).json({
          error: "This user already has an active personal range",
        });
      }
    }

    const overlap = await findOverlap(rangeStart as number, rangeEnd as number);
    if (overlap) {
      return res.status(400).json({ error: "The range overlaps an active range" });
    }

    const range = await NumberRange.create({
      label: typeof label === "string" ? label.trim() : undefined,
      scope,
      userId: scope === "personal" ? userId : undefined,
      rangeStart,
      rangeEnd,
      nextNumber: rangeStart,
      createdBy: req.user?._id,
    });

    return res.status(201).json(serializeRange(range));
  } catch {
    return res.status(500).json({ error: "Failed to create number range" });
  }
};

export const listRanges = async (_req: Request, res: Response) => {
  try {
    const ranges = await NumberRange.find()
      .populate("userId", "name phone")
      .sort({ createdAt: 1 });

    return res.json(ranges.map(serializeRange));
  } catch {
    return res.status(500).json({ error: "Failed to fetch number ranges" });
  }
};

export const updateRange = async (req: AuthRequest, res: Response) => {
  const { label, isActive, userId, rangeEnd } = req.body as Record<string, unknown>;

  try {
    const range = await NumberRange.findById(req.params.id);
    if (!range) {
      return res.status(404).json({ error: "Number range not found" });
    }

    if (label !== undefined) {
      range.label = typeof label === "string" ? label.trim() : range.label;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ error: "isActive must be boolean" });
      }
      range.isActive = isActive;
    }

    if (range.scope !== "personal" && userId !== undefined) {
      return res.status(400).json({ error: "Only personal ranges can change user" });
    }

    const nextUserId = userId === undefined ? range.userId : userId;
    if (range.scope === "personal") {
      if (!nextUserId || !Types.ObjectId.isValid(String(nextUserId))) {
        return res.status(400).json({ error: "A valid user is required for a personal range" });
      }

      const assignedUser = await User.exists({ _id: nextUserId });
      if (!assignedUser) {
        return res.status(400).json({ error: "Assigned user was not found" });
      }

      const existingPersonal = await NumberRange.findOne({
        _id: { $ne: range._id },
        scope: "personal",
        userId: nextUserId,
        isActive: true,
        isExhausted: false,
      });

      const targetIsActive = isActive === undefined ? range.isActive : isActive;
      if (existingPersonal && targetIsActive && !range.isExhausted) {
        return res.status(400).json({
          error: "This user already has an active personal range",
        });
      }

      range.userId = new Types.ObjectId(String(nextUserId));
    }

    if (rangeEnd !== undefined) {
      const boundsError = validateBounds(range.rangeStart, rangeEnd);
      if (boundsError) {
        return res.status(400).json({ error: boundsError });
      }

      if ((rangeEnd as number) < range.nextNumber - 1) {
        return res.status(400).json({
          error: "Cannot shrink a range below numbers already issued",
        });
      }

      if ((rangeEnd as number) < range.rangeEnd) {
        return res.status(400).json({ error: "Range end can only be extended upward" });
      }

      const overlap = await findOverlap(range.rangeStart, rangeEnd as number, String(range._id));
      if (overlap) {
        return res.status(400).json({ error: "The range overlaps an active range" });
      }

      range.rangeEnd = rangeEnd as number;
      if (range.nextNumber <= range.rangeEnd) {
        range.isExhausted = false;
      }
    }

    if (range.isActive && isActive === true) {
      const overlap = await findOverlap(range.rangeStart, range.rangeEnd, String(range._id));
      if (overlap) {
        return res.status(400).json({ error: "The range overlaps an active range" });
      }
    }

    await range.save();
    return res.json(serializeRange(await NumberRange.findById(range._id).populate("userId", "name phone")));
  } catch {
    return res.status(500).json({ error: "Failed to update number range" });
  }
};

export const deleteRange = async (req: Request, res: Response) => {
  try {
    const range = await NumberRange.findById(req.params.id);
    if (!range) {
      return res.status(404).json({ error: "Number range not found" });
    }

    if (range.nextNumber !== range.rangeStart) {
      return res.status(400).json({
        error: "This range has issued numbers. Deactivate it instead",
      });
    }

    await range.deleteOne();
    return res.json({ message: "Number range deleted successfully" });
  } catch {
    return res.status(500).json({ error: "Failed to delete number range" });
  }
};
