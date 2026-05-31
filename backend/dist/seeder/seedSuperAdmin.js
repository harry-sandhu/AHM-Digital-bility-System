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
    const superAdminPhone = (0, phoneUtils_1.normalizePhone)(process.env.SUPERADMIN_PHONE || "0000000000");
    const superAdminPassword = process.env.SUPERADMIN_PASSWORD || "admin123";
    const existing = yield User_1.default.findOne({ role: "superadmin" });
    if (!existing) {
        const hashedPassword = yield bcryptjs_1.default.hash(superAdminPassword, 10);
        yield User_1.default.create({
            name: "Super Admin",
            phone: superAdminPhone,
            password: hashedPassword,
            role: "superadmin",
            isActive: true,
        });
        console.log(`SuperAdmin seeded: ${superAdminPhone} / ${superAdminPassword}`);
    }
});
exports.seedSuperAdmin = seedSuperAdmin;
