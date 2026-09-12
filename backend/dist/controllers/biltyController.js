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
exports.getAllBilty = exports.getMyBilty = exports.updateBilty = exports.purchaseBiltyAccess = exports.generateBilty = void 0;
const bilty_1 = __importDefault(require("../models/bilty"));
const BiltyCounter_1 = __importDefault(require("../models/BiltyCounter"));
const User_1 = __importDefault(require("../models/User"));
const numberRange_1 = require("../utils/numberRange");
const biltyPricing_1 = require("../utils/biltyPricing");
const canManageAllBilties = (role) => role === "superadmin" || role === "admin";
const DEFAULT_BILTY_ACCESS_AMOUNT = 200;
const getLocalMidnightDeadline = (fromDate = new Date()) => {
    const deadline = new Date(fromDate);
    deadline.setHours(23, 59, 59, 999);
    return deadline;
};
const isPastDeadline = (deadline) => {
    if (!deadline) {
        return true;
    }
    return new Date(deadline).getTime() < Date.now();
};
const serializeBiltyAccess = (user) => ({
    biltyAccessPaidAt: user.biltyAccessPaidAt
        ? new Date(user.biltyAccessPaidAt).toISOString()
        : null,
    biltyAccessExpiresAt: user.biltyAccessExpiresAt
        ? new Date(user.biltyAccessExpiresAt).toISOString()
        : null,
    biltyAccessAmount: typeof user.biltyAccessAmount === "number" ? user.biltyAccessAmount : 0,
    biltyAccessFreightAmount: typeof user.biltyAccessFreightAmount === "number"
        ? user.biltyAccessFreightAmount
        : null,
});
const getBiltyStatus = (expiresAt) => expiresAt && !isPastDeadline(expiresAt) ? "draft" : "expired";
const generateBilty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        if (isPastDeadline(req.user.biltyAccessExpiresAt)) {
            return res.status(402).json({
                error: "Payment required before bilty generation",
            });
        }
        const activeBilty = yield bilty_1.default.findOne({
            createdBy: req.user._id,
            expiresAt: { $gte: new Date() },
        }).sort({ createdAt: -1 });
        if (activeBilty) {
            return res.status(200).json({
                message: "Bilty already reserved",
                biltyId: activeBilty._id,
                biltyNumber: activeBilty.biltyNumber,
                consignmentNo: activeBilty.consignmentNo,
                expiresAt: activeBilty.expiresAt,
                paymentAmount: activeBilty.paymentAmount || req.user.biltyAccessAmount || DEFAULT_BILTY_ACCESS_AMOUNT,
            });
        }
        let consignmentNo;
        try {
            consignmentNo = yield (0, numberRange_1.allocateConsignmentNumber)(req.user._id);
        }
        catch (error) {
            if (error instanceof Error && error.message === numberRange_1.NO_CONSIGNMENT_NUMBERS_ERROR) {
                return res.status(409).json({ error: numberRange_1.NO_CONSIGNMENT_NUMBERS_ERROR });
            }
            throw error;
        }
        const prefix = `AHM-${new Date().getFullYear()}`;
        const counter = yield BiltyCounter_1.default.findOneAndUpdate({ prefix }, { $inc: { counter: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
        const biltyNumber = `${prefix}-${String(counter.counter).padStart(4, "0")}`;
        const expiresAt = req.user.biltyAccessExpiresAt
            ? new Date(req.user.biltyAccessExpiresAt)
            : getLocalMidnightDeadline();
        const bilty = yield bilty_1.default.create({
            biltyNumber,
            consignmentNo,
            createdBy: req.user._id,
            formData: {},
            status: getBiltyStatus(expiresAt),
            paymentAmount: req.user.biltyAccessAmount || DEFAULT_BILTY_ACCESS_AMOUNT,
            paymentPaidAt: req.user.biltyAccessPaidAt || new Date(),
            paymentExpiresAt: expiresAt,
            expiresAt,
        });
        res.status(201).json({
            message: "Bilty reserved",
            biltyId: bilty._id,
            biltyNumber,
            consignmentNo,
            expiresAt,
            paymentAmount: bilty.paymentAmount,
        });
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to generate bilty number" });
    }
});
exports.generateBilty = generateBilty;
const purchaseBiltyAccess = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        const freightAmount = Number((_a = req.body) === null || _a === void 0 ? void 0 : _a.freightAmount);
        if (!Number.isFinite(freightAmount) || freightAmount <= 0) {
            return res.status(400).json({
                error: "A valid freight amount greater than zero is required",
            });
        }
        const user = yield User_1.default.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (!user.isActive) {
            return res.status(403).json({ error: "Your account has been disabled" });
        }
        const now = new Date();
        const existingExpiry = user.biltyAccessExpiresAt
            ? new Date(user.biltyAccessExpiresAt)
            : null;
        if (existingExpiry && existingExpiry.getTime() >= now.getTime()) {
            return res.status(200).json({
                message: "Bilty access is already active",
                user: Object.assign({ id: String(user._id), name: user.name, phone: user.phone, role: user.role, isActive: user.isActive }, serializeBiltyAccess(user)),
            });
        }
        const expiresAt = getLocalMidnightDeadline(now);
        const biltyAccessAmount = (0, biltyPricing_1.getBiltyAccessAmount)(freightAmount);
        user.biltyAccessPaidAt = now;
        user.biltyAccessExpiresAt = expiresAt;
        user.biltyAccessAmount = biltyAccessAmount;
        user.biltyAccessFreightAmount = freightAmount;
        yield user.save();
        res.status(200).json({
            message: "Bilty access activated",
            user: Object.assign({ id: String(user._id), name: user.name, phone: user.phone, role: user.role, isActive: user.isActive }, serializeBiltyAccess(user)),
        });
    }
    catch (_b) {
        res.status(500).json({ error: "Failed to activate bilty access" });
    }
});
exports.purchaseBiltyAccess = purchaseBiltyAccess;
const updateBilty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        const biltyId = req.params.id;
        const formData = req.body.formData;
        const bilty = yield bilty_1.default.findById(biltyId);
        if (!bilty) {
            return res.status(404).json({ error: "Bilty not found" });
        }
        if (String(bilty.createdBy) !== String(req.user._id) &&
            !canManageAllBilties(req.user.role)) {
            return res.status(403).json({ error: "Access denied" });
        }
        if (bilty.expiresAt && isPastDeadline(bilty.expiresAt)) {
            if (bilty.status !== "expired") {
                bilty.status = "expired";
                yield bilty.save();
            }
            return res.status(410).json({
                error: "Bilty expired. Please create a new bilty after paying again.",
            });
        }
        const nextFormData = Object.assign(Object.assign({}, (formData && typeof formData === "object" ? formData : {})), { consignmentNo: String((_a = bilty.consignmentNo) !== null && _a !== void 0 ? _a : "") });
        if (typeof req.user.biltyAccessFreightAmount === "number") {
            nextFormData.freight = String(req.user.biltyAccessFreightAmount);
        }
        bilty.formData = nextFormData;
        bilty.status = "draft";
        yield bilty.save();
        const populatedBilty = yield bilty_1.default.findById(bilty._id).populate("createdBy", "name phone role");
        res.json({
            message: "Bilty updated successfully",
            bilty: populatedBilty,
        });
    }
    catch (_b) {
        res.status(500).json({ error: "Failed to update bilty" });
    }
});
exports.updateBilty = updateBilty;
const getMyBilty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        const biltys = yield bilty_1.default.find({ createdBy: req.user._id })
            .populate("createdBy", "name phone role")
            .sort({ createdAt: -1 });
        res.status(200).json(biltys.map((bilty) => (Object.assign(Object.assign({}, bilty.toObject()), { status: bilty.expiresAt && isPastDeadline(bilty.expiresAt)
                ? "expired"
                : bilty.status || "draft" }))));
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to fetch bilty records" });
    }
});
exports.getMyBilty = getMyBilty;
const getAllBilty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const biltys = yield bilty_1.default.find()
            .populate("createdBy", "name phone role")
            .sort({ createdAt: -1 });
        res.status(200).json(biltys.map((bilty) => (Object.assign(Object.assign({}, bilty.toObject()), { status: bilty.expiresAt && isPastDeadline(bilty.expiresAt)
                ? "expired"
                : bilty.status || "draft" }))));
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to fetch bilty records" });
    }
});
exports.getAllBilty = getAllBilty;
