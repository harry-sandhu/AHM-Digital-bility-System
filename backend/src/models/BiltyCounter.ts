import { Schema, model, Document } from "mongoose";

interface IBiltyCounter extends Document {
  prefix: string;
  counter: number;
}

const biltyCounterSchema = new Schema<IBiltyCounter>({
  prefix: { type: String, required: true },
  counter: { type: Number, default: 1 },
});

export default model<IBiltyCounter>("BiltyCounter", biltyCounterSchema);
