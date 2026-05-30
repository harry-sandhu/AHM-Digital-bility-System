import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import biltyRoutes from "./routes/biltyRoutes";
import userRoutes from "./routes/userRoutes";
import errorHandler from "./middleware/errorMiddleware";
import { seedSuperAdmin } from "./seeder/seedSuperAdmin";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/bilty", biltyRoutes);
app.use("/api/users", userRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bilty";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB Connected");
    await seedSuperAdmin();
    app.listen(PORT, () => console.log(`✅ Server running on PORT ${PORT}`));
  })
  .catch((err: unknown) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
