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

const allowedOrigins = (process.env.FRONTEND_URL || "https://ahm-digital-bility-system.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (health checks, curl, server-to-server calls).
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
  })
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

const billExtractionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many bill uploads. Please try again later." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/bilty/pay", paymentLimiter);
app.use("/api/bilty/extract-bill", billExtractionLimiter);

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

let databasePromise: Promise<typeof mongoose> | undefined;

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return mongoose;

  databasePromise ??= mongoose
    .connect(MONGO_URI)
    .then(async (connection) => {
      console.log("✅ MongoDB Connected");
      await seedSuperAdmin();
      return connection;
    })
    .catch((err: unknown) => {
      databasePromise = undefined;
      console.error("❌ MongoDB connection error:", err);
      throw err;
    });

  return databasePromise;
};

// Local development/startup entrypoint. Vercel imports `app` and connects per request.
if (require.main === module) {
  connectDatabase()
    .then(() => app.listen(PORT, () => console.log(`✅ Server running on PORT ${PORT}`)))
    .catch(() => process.exit(1));
}

export default app;
