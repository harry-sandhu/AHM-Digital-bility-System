import { Types } from "mongoose";
import Bilty from "../models/bilty";
import NumberRange from "../models/NumberRange";

export const NO_CONSIGNMENT_NUMBERS_ERROR =
  "No consignment numbers available. Contact admin.";

const findAvailableRange = async (userId: Types.ObjectId) => {
  const personal = await NumberRange.findOne({
    scope: "personal",
    userId,
    isActive: true,
    isExhausted: false,
  }).sort({ createdAt: 1 });

  if (personal) {
    return personal;
  }

  return NumberRange.findOne({
    scope: "master",
    isActive: true,
    isExhausted: false,
  }).sort({ createdAt: 1 });
};

export const allocateConsignmentNumber = async (
  userId: Types.ObjectId
): Promise<number> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const range = await findAvailableRange(userId);

    if (!range) {
      throw new Error(NO_CONSIGNMENT_NUMBERS_ERROR);
    }

    const candidate = range.nextNumber;

    if (candidate > range.rangeEnd) {
      await NumberRange.updateOne(
        { _id: range._id, nextNumber: candidate },
        { $set: { isExhausted: true } }
      );
      continue;
    }

    // A deleted number may create a gap behind nextNumber. Skip numbers that
    // are still in use before reserving the next candidate.
    const alreadyUsed = await Bilty.exists({ consignmentNo: candidate });
    if (alreadyUsed) {
      const skipped = await NumberRange.findOneAndUpdate(
        {
          _id: range._id,
          nextNumber: candidate,
          isActive: true,
          isExhausted: false,
        },
        { $inc: { nextNumber: 1 } },
        { new: true }
      );

      if (skipped && skipped.nextNumber > skipped.rangeEnd) {
        await NumberRange.updateOne(
          { _id: skipped._id, nextNumber: skipped.nextNumber },
          { $set: { isExhausted: true } }
        );
      }
      continue;
    }

    const updated = await NumberRange.findOneAndUpdate(
      {
        _id: range._id,
        nextNumber: candidate,
        isActive: true,
        isExhausted: false,
      },
      { $inc: { nextNumber: 1 } },
      { new: true }
    );

    if (!updated) {
      continue;
    }

    if (updated.nextNumber > updated.rangeEnd) {
      await NumberRange.updateOne(
        { _id: updated._id, nextNumber: updated.nextNumber },
        { $set: { isExhausted: true } }
      );
    }

    return candidate;
  }

  throw new Error(NO_CONSIGNMENT_NUMBERS_ERROR);
};

export const resetRangeToFirstAvailable = async (rangeId: Types.ObjectId) => {
  const range = await NumberRange.findById(rangeId);
  if (!range) {
    return;
  }

  const usedBilties = await Bilty.find({
    consignmentNo: {
      $gte: range.rangeStart,
      $lte: range.rangeEnd,
    },
  })
    .select("consignmentNo")
    .lean();

  const usedNumbers = new Set(
    usedBilties
      .map((bilty) => bilty.consignmentNo)
      .filter((number): number is number => typeof number === "number")
  );

  let nextNumber = range.rangeStart;
  while (nextNumber <= range.rangeEnd && usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  range.nextNumber = nextNumber;
  range.isExhausted = nextNumber > range.rangeEnd;
  await range.save();
};
