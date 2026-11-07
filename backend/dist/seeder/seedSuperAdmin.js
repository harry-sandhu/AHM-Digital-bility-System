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
exports.seedSuperAdmin = void 0;
const User_1 = __importDefault(require("../models/User"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const phoneUtils_1 = require("../utils/phoneUtils");
const seedSuperAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    const existing = yield User_1.default.findOne({ role: "superadmin" });
    if (existing) {
        return;
    }
    if (!process.env.SUPERADMIN_PHONE || !process.env.SUPERADMIN_PASSWORD) {
        throw new Error("No superadmin exists yet, and SUPERADMIN_PHONE/SUPERADMIN_PASSWORD are not set. " +
            "Set both environment variables before starting the server.");
    }
    const superAdminPhone = (0, phoneUtils_1.normalizePhone)(process.env.SUPERADMIN_PHONE);
    const superAdminPassword = process.env.SUPERADMIN_PASSWORD;
    const hashedPassword = yield bcryptjs_1.default.hash(superAdminPassword, 10);
    yield User_1.default.create({
        name: "Super Admin",
        phone: superAdminPhone,
        password: hashedPassword,
        role: "superadmin",
        isActive: true,
    });
    console.log(`SuperAdmin seeded: ${superAdminPhone}`);
});
exports.seedSuperAdmin = seedSuperAdmin;
