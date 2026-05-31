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
exports.disableUser = exports.createAdmin = exports.getAllUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../models/User"));
const phoneUtils_1 = require("../utils/phoneUtils");
const getAllUsers = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield User_1.default.find()
            .select("-password")
            .sort({ createdAt: -1, name: 1 });
        res.json(users);
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});
exports.getAllUsers = getAllUsers;
const createAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, phone, password } = req.body;
    const trimmedName = name === null || name === void 0 ? void 0 : name.trim();
    const normalizedPhone = phone ? (0, phoneUtils_1.normalizePhone)(phone) : "";
    if (!trimmedName || !normalizedPhone || !password) {
        return res
            .status(400)
            .json({ error: "Name, phone and password are required" });
    }
    if (!(0, phoneUtils_1.isPhoneLengthValid)(normalizedPhone)) {
        return res
            .status(400)
            .json({ error: "Phone number must contain 10 to 15 digits" });
    }
    try {
        const existing = yield User_1.default.findOne({ phone: normalizedPhone });
        if (existing) {
            return res.status(400).json({ error: "Phone already exists" });
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const admin = yield User_1.default.create({
            name: trimmedName,
            phone: normalizedPhone,
            password: hashedPassword,
            role: "admin",
            isActive: true,
        });
        res.status(201).json({
            message: "Admin created successfully",
            user: {
                id: admin._id,
                name: admin.name,
                phone: admin.phone,
                role: admin.role,
                isActive: admin.isActive,
            },
        });
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to create admin" });
    }
});
exports.createAdmin = createAdmin;
const disableUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const targetUser = yield User_1.default.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }
        if (targetUser.role !== "user") {
            return res
                .status(400)
                .json({ error: "Only normal users can be disabled" });
        }
        if (!targetUser.isActive) {
            return res.status(400).json({ error: "User is already disabled" });
        }
        targetUser.isActive = false;
        yield targetUser.save();
        res.json({ message: "User disabled successfully" });
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to disable user" });
    }
});
exports.disableUser = disableUser;
