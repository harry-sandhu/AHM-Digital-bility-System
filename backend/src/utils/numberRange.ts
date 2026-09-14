import { Types } from "mongoose";
import Bilty from "../models/bilty";
import NumberRange from "../models/NumberRange";

export const NO_CONSIGNMENT_NUMBERS_ERROR =
  "No consignment numbers available. Contact admin.";

const findAvailableRanges = async (userId: Types.ObjectId) => {
  const personal = await NumberRange.find({
    scope: "personal",
    userId,
    isActive: true,
  }).sort({ createdAt: 1 });

  const master = await NumberRange.find({
    scope: "master",
    isActive: true,
  }).sort({ createdAt: 1 });

  return [...personal, ...master];
};

const getUsedNumbers = async (rangeStart: number, rangeEnd: number) => {
  const usedBilties = await Bilty.find({
    consignmentNo: { $gte: rangeStart, $lte: rangeEnd },
  })
    .select("consignmentNo")
    .lean();

  return new Set(
    usedBilties
      .map((bilty) => bilty.consignmentNo)
      .filter((number): number is number => typeof number === "number")
  );
};

export const allocateConsignmentNumber = async (
  userId: Types.ObjectId
): Promise<number> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ranges = await findAvailableRanges(userId);
    if (!ranges.length) {
      throw new Error(NO_CONSIGNMENT_NUMBERS_ERROR);
    }

    for (const range of ranges) {
      const usedNumbers = await getUsedNumbers(range.rangeStart, range.rangeEnd);
      let candidate = range.rangeStart;

      while (candidate <= range.rangeEnd && usedNumbers.has(candidate)) {
        candidate += 1;
      }

      if (candidate > range.rangeEnd) {
        await NumberRange.updateOne(
          { _id: range._id, isActive: true },
          { $set: { nextNumber: candidate, isExhausted: true } }
        );
        continue;
      }

      // Match the stored value so concurrent requests cannot reserve the same
      // range state. The next allocation will rescan the range if this loses.
      const updated = await NumberRange.findOneAndUpdate(
        {
          _id: range._id,
          nextNumber: range.nextNumber,
          isActive: true,
        },
        {
          $set: {
            nextNumber: candidate + 1,
            isExhausted: candidate >= range.rangeEnd,
          },
        },
        { new: true }
      );

      if (updated) {
        return candidate;
      }
    }
  }

  throw new Error(NO_CONSIGNMENT_NUMBERS_ERROR);
};

export const resetRangeToFirstAvailable = async (rangeId: Types.ObjectId) => {
  const range = await NumberRange.findById(rangeId);
  if (!range) {
    return;
  }

  const usedNumbers = await getUsedNumbers(range.rangeStart, range.rangeEnd);

  let nextNumber = range.rangeStart;
  while (nextNumber <= range.rangeEnd && usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  range.nextNumber = nextNumber;
  range.isExhausted = nextNumber > range.rangeEnd;
  await range.save();
};
