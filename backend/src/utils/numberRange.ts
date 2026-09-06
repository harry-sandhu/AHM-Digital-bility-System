import { Types } from "mongoose";
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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const range = await findAvailableRange(userId);

    if (!range) {
      throw new Error(NO_CONSIGNMENT_NUMBERS_ERROR);
    }

    const updated = await NumberRange.findOneAndUpdate(
      {
        _id: range._id,
        nextNumber: { $lte: range.rangeEnd },
      },
      { $inc: { nextNumber: 1 } },
      { new: true }
    );

    if (!updated) {
      continue;
    }

    const issuedNumber = updated.nextNumber - 1;

    if (updated.nextNumber > updated.rangeEnd) {
      await NumberRange.updateOne(
        { _id: updated._id, nextNumber: updated.nextNumber },
        { $set: { isExhausted: true } }
      );
    }

    return issuedNumber;
  }

  throw new Error(NO_CONSIGNMENT_NUMBERS_ERROR);
};
