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
exports.getAllBilty = exports.getMyBilty = exports.updateBilty = exports.generateBilty = void 0;
const bilty_1 = __importDefault(require("../models/bilty"));
const BiltyCounter_1 = __importDefault(require("../models/BiltyCounter"));
const canManageAllBilties = (role) => role === "superadmin" || role === "admin";
const generateBilty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        const prefix = `AHM-${new Date().getFullYear()}`;
        const counter = yield BiltyCounter_1.default.findOneAndUpdate({ prefix }, { $inc: { counter: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
        const biltyNumber = `${prefix}-${String(counter.counter).padStart(4, "0")}`;
        const bilty = yield bilty_1.default.create({
            biltyNumber,
            createdBy: req.user._id,
            formData: {},
        });
        res.status(201).json({
            message: "Bilty reserved",
            biltyId: bilty._id,
            biltyNumber,
        });
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to generate bilty number" });
    }
});
exports.generateBilty = generateBilty;
const updateBilty = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        bilty.formData = formData;
        yield bilty.save();
        const populatedBilty = yield bilty_1.default.findById(bilty._id).populate("createdBy", "name phone role");
        res.json({
            message: "Bilty updated successfully",
            bilty: populatedBilty,
        });
    }
    catch (_a) {
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
        res.status(200).json(biltys);
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
        res.status(200).json(biltys);
    }
    catch (_a) {
        res.status(500).json({ error: "Failed to fetch bilty records" });
    }
});
exports.getAllBilty = getAllBilty;
