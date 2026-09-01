import { Schema, model, Document, Types } from "mongoose";

interface IBilty extends Document {
  biltyNumber: string;
  createdBy: Types.ObjectId;
  formData?: object;
  status?: "draft" | "expired";
  paymentAmount?: number;
  paymentPaidAt?: Date;
  paymentExpiresAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
}

const biltySchema = new Schema<IBilty>({
  biltyNumber: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  formData: Object,
  status: { type: String, enum: ["draft", "expired"], default: "draft" },
  paymentAmount: { type: Number, default: 0 },
  paymentPaidAt: { type: Date },
  paymentExpiresAt: { type: Date },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export default model<IBilty>("Bilty", biltySchema);
