import { Schema, model, Document } from "mongoose";

interface IUser extends Document {
  name: string;
  phone: string;
  password: string;
  role: "superadmin" | "admin";
}

const userSchema = new Schema<IUser>({
  name: String,
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["superadmin", "admin"], default: "admin" },
});

export default model<IUser>("User", userSchema);
