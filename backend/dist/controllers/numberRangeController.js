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
exports.deleteRange = exports.updateRange = exports.listRanges = exports.createRange = void 0;
const mongoose_1 = require("mongoose");
const NumberRange_1 = __importDefault(require("../models/NumberRange"));
const User_1 = __importDefault(require("../models/User"));
const isValidInteger = (value) => typeof value === "number" && Number.isInteger(value);
const validateBounds = (rangeStart, rangeEnd) => {
    if (!isValidInteger(rangeStart) || !isValidInteger(rangeEnd)) {
        return "Range start and end must be integers";
    }
    if (rangeStart < 1000 || rangeEnd < 1000) {
        return "Range values must be at least 1000";
    }
    if (rangeStart > rangeEnd) {
        return "Range start cannot be greater than range end";
    }
    return null;
};
const findOverlap = (rangeStart, rangeEnd, excludeId) => NumberRange_1.default.findOne(Object.assign(Object.assign({}, (excludeId ? { _id: { $ne: excludeId } } : {})), { isActive: true, rangeStart: { $lte: rangeEnd }, rangeEnd: { $gte: rangeStart } }));
const serializeRange = (range) => (Object.assign(Object.assign({}, range.toObject()), { remaining: Math.max(0, range.rangeEnd - range.nextNumber + 1) }));
const createRange = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { label, scope, userId, rangeStart, rangeEnd, } = req.body;
    const boundsError = validateBounds(rangeStart, rangeEnd);
    if (boundsError) {
        return res.status(400).json({ error: boundsError });
    }
    if (scope !== "master" && scope !== "personal") {
        return res.status(400).json({ error: "Scope must be master or personal" });
    }
    if (scope === "personal" && (!userId || !mongoose_1.Types.ObjectId.isValid(String(userId)))) {
        return res.status(400).json({ error: "A valid user is required for a personal range" });
    }
    try {
        if (scope === "personal") {
            const assignedUser = yield User_1.default.exists({ _id: userId });
            if (!assignedUser) {
                return res.status(400).json({ error: "Assigned user was not found" });
            }
            const existingPersonal = yield NumberRange_1.default.findOne({
                scope: "personal",
                userId,
                isActive: true,
                isExhausted: false,
            });
            if (existingPersonal) {
                return res.status(400).json({
                    error: "This user already has an active personal range",
                });
            }
        }
        const overlap = yield findOverlap(rangeStart, rangeEnd);
        if (overlap) {
            return res.status(400).json({ error: "The range overlaps an active range" });
        }
        const range = yield NumberRange_1.default.create({
            label: typeof label === "string" ? label.trim() : undefined,
            scope,
            userId: scope === "personal" ? userId : undefined,
            rangeStart,
            rangeEnd,
            nextNumber: rangeStart,
            createdBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
        });
        return res.status(201).json(serializeRange(range));
    }
    catch (_b) {
        return res.status(500).json({ error: "Failed to create number range" });
    }
});
exports.createRange = createRange;
const listRanges = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ranges = yield NumberRange_1.default.find()
            .populate("userId", "name phone")
            .sort({ createdAt: 1 });
        return res.json(ranges.map(serializeRange));
    }
    catch (_a) {
        return res.status(500).json({ error: "Failed to fetch number ranges" });
    }
});
exports.listRanges = listRanges;
const updateRange = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { label, isActive, userId, rangeEnd } = req.body;
    try {
        const range = yield NumberRange_1.default.findById(req.params.id);
        if (!range) {
            return res.status(404).json({ error: "Number range not found" });
        }
        if (label !== undefined) {
            range.label = typeof label === "string" ? label.trim() : range.label;
        }
        if (isActive !== undefined) {
            if (typeof isActive !== "boolean") {
                return res.status(400).json({ error: "isActive must be boolean" });
            }
            range.isActive = isActive;
        }
        if (range.scope !== "personal" && userId !== undefined) {
            return res.status(400).json({ error: "Only personal ranges can change user" });
        }
        const nextUserId = userId === undefined ? range.userId : userId;
        if (range.scope === "personal") {
            if (!nextUserId || !mongoose_1.Types.ObjectId.isValid(String(nextUserId))) {
                return res.status(400).json({ error: "A valid user is required for a personal range" });
            }
            const assignedUser = yield User_1.default.exists({ _id: nextUserId });
            if (!assignedUser) {
                return res.status(400).json({ error: "Assigned user was not found" });
            }
            const existingPersonal = yield NumberRange_1.default.findOne({
                _id: { $ne: range._id },
                scope: "personal",
                userId: nextUserId,
                isActive: true,
                isExhausted: false,
            });
            const targetIsActive = isActive === undefined ? range.isActive : isActive;
            if (existingPersonal && targetIsActive && !range.isExhausted) {
                return res.status(400).json({
                    error: "This user already has an active personal range",
                });
            }
            range.userId = new mongoose_1.Types.ObjectId(String(nextUserId));
        }
        if (rangeEnd !== undefined) {
            const boundsError = validateBounds(range.rangeStart, rangeEnd);
            if (boundsError) {
                return res.status(400).json({ error: boundsError });
            }
            if (rangeEnd < range.nextNumber - 1) {
                return res.status(400).json({
                    error: "Cannot shrink a range below numbers already issued",
                });
            }
            if (rangeEnd < range.rangeEnd) {
                return res.status(400).json({ error: "Range end can only be extended upward" });
            }
            const overlap = yield findOverlap(range.rangeStart, rangeEnd, String(range._id));
            if (overlap) {
                return res.status(400).json({ error: "The range overlaps an active range" });
            }
            range.rangeEnd = rangeEnd;
            if (range.nextNumber <= range.rangeEnd) {
                range.isExhausted = false;
            }
        }
        if (range.isActive && isActive === true) {
            const overlap = yield findOverlap(range.rangeStart, range.rangeEnd, String(range._id));
            if (overlap) {
                return res.status(400).json({ error: "The range overlaps an active range" });
            }
        }
        yield range.save();
        return res.json(serializeRange(yield NumberRange_1.default.findById(range._id).populate("userId", "name phone")));
    }
    catch (_a) {
        return res.status(500).json({ error: "Failed to update number range" });
    }
});
exports.updateRange = updateRange;
const deleteRange = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const range = yield NumberRange_1.default.findById(req.params.id);
        if (!range) {
            return res.status(404).json({ error: "Number range not found" });
        }
        if (range.nextNumber !== range.rangeStart) {
            return res.status(400).json({
                error: "This range has issued numbers. Deactivate it instead",
            });
        }
        yield range.deleteOne();
        return res.json({ message: "Number range deleted successfully" });
    }
    catch (_a) {
        return res.status(500).json({ error: "Failed to delete number range" });
    }
});
exports.deleteRange = deleteRange;
