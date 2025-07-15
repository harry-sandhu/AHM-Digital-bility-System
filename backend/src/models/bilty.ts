import { Schema, model, Document, Types } from "mongoose";

interface IBilty extends Document {
  biltyNumber: string;
  createdBy: Types.ObjectId;
  formData?: object;
  createdAt?: Date;
}

const biltySchema = new Schema<IBilty>({
  biltyNumber: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  formData: Object,
  createdAt: { type: Date, default: Date.now },
});

export default model<IBilty>("Bilty", biltySchema);
