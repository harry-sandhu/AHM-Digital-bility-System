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
exports.getCurrentUser = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../models/User"));
const phoneUtils_1 = require("../utils/phoneUtils");
const tokenUtils_1 = require("../utils/tokenUtils");
const sanitizeUser = (user) => ({
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
});
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const user = yield User_1.default.create({
            name: trimmedName,
            phone: normalizedPhone,
            password: hashedPassword,
            role: "user",
            isActive: true,
        });
        res.status(201).json({
            message: "User registered successfully",
            user: sanitizeUser(user),
        });
    }
    catch (_a) {
        res.status(500).json({ error: "Registration failed" });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phone, password } = req.body;
    const normalizedPhone = phone ? (0, phoneUtils_1.normalizePhone)(phone) : "";
    if (!normalizedPhone || !password) {
        return res.status(400).json({ error: "Phone and password are required" });
    }
    if (!(0, phoneUtils_1.isPhoneLengthValid)(normalizedPhone)) {
        return res
            .status(400)
            .json({ error: "Phone number must contain 10 to 15 digits" });
    }
    try {
        const user = yield User_1.default.findOne({ phone: normalizedPhone });
        if (!user) {
            return res.status(400).json({ error: "Invalid phone or password" });
        }
        if (!user.isActive) {
            return res.status(403).json({ error: "Your account has been disabled" });
        }
        const isMatch = yield bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid phone or password" });
        }
        const token = (0, tokenUtils_1.signToken)({ id: user._id });
        res.json({
            token,
            user: sanitizeUser(user),
        });
    }
    catch (_a) {
        res.status(500).json({ error: "Login failed" });
    }
});
exports.login = login;
const getCurrentUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    return res.json({ user: sanitizeUser(req.user) });
});
exports.getCurrentUser = getCurrentUser;
