import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes";
import biltyRoutes from "./routes/biltyRoutes";
import userRoutes from "./routes/userRoutes";
import numberRangeRoutes from "./routes/numberRangeRoutes";
import errorHandler from "./middleware/errorMiddleware";
import { seedSuperAdmin } from "./seeder/seedSuperAdmin";

dotenv.config();

const app = express();

const allowedOrigin = process.env.FRONTEND_URL;
app.use(
  cors(
    allowedOrigin
      ? { origin: allowedOrigin }
      : process.env.NODE_ENV === "production"
        ? { origin: false }
        : undefined
  )
);
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/bilty/pay", paymentLimiter);

app.get("/", (_req, res) => {
  res.send("server running ok");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/bilty", biltyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/number-ranges", numberRangeRoutes);

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
