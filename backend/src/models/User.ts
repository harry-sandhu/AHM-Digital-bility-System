import { Schema, model, Document, Types } from "mongoose";
import type { Role } from "../utils/types";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  password: string;
  role: Role;
  isActive: boolean;
  biltyAccessPaidAt?: Date;
  biltyAccessExpiresAt?: Date;
  biltyAccessAmount?: number;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["superadmin", "admin", "user"],
      default: "user",
    },
    isActive: { type: Boolean, default: true },
    biltyAccessPaidAt: { type: Date },
    biltyAccessExpiresAt: { type: Date },
    biltyAccessAmount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export default model<IUser>("User", userSchema);
