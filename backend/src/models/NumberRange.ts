import { Document, model, Schema, Types } from "mongoose";

export type NumberRangeScope = "master" | "personal";

export interface INumberRange extends Document {
  _id: Types.ObjectId;
  label?: string;
  scope: NumberRangeScope;
  userId?: Types.ObjectId;
  rangeStart: number;
  rangeEnd: number;
  nextNumber: number;
  isExhausted: boolean;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const numberRangeSchema = new Schema<INumberRange>(
  {
    label: { type: String, trim: true },
    scope: { type: String, enum: ["master", "personal"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    rangeStart: { type: Number, required: true, min: 1000 },
    rangeEnd: { type: Number, required: true, min: 1000 },
    nextNumber: { type: Number, required: true },
    isExhausted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Only one active, non-exhausted personal range may exist per userId at a time.
// This is enforced in the controller rather than by the schema.

export default model<INumberRange>("NumberRange", numberRangeSchema);
