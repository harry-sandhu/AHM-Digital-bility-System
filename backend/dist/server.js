"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const biltyRoutes_1 = __importDefault(require("./routes/biltyRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const errorMiddleware_1 = __importDefault(require("./middleware/errorMiddleware"));
const seedSuperAdmin_1 = require("./seeder/seedSuperAdmin");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api/auth", authRoutes_1.default);
app.use("/api/bilty", biltyRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use(errorMiddleware_1.default);
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bilty";
mongoose_1.default
    .connect(MONGO_URI)
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log("✅ MongoDB Connected");
    yield (0, seedSuperAdmin_1.seedSuperAdmin)();
    app.listen(PORT, () => console.log(`✅ Server running on PORT ${PORT}`));
}))
    .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
});
