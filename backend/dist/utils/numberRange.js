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
exports.resetRangeToFirstAvailable = exports.allocateConsignmentNumber = exports.NO_CONSIGNMENT_NUMBERS_ERROR = void 0;
const bilty_1 = __importDefault(require("../models/bilty"));
const NumberRange_1 = __importDefault(require("../models/NumberRange"));
exports.NO_CONSIGNMENT_NUMBERS_ERROR = "No consignment numbers available. Contact admin.";
const findAvailableRange = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const personal = yield NumberRange_1.default.findOne({
        scope: "personal",
        userId,
        isActive: true,
        isExhausted: false,
    }).sort({ createdAt: 1 });
    if (personal) {
        return personal;
    }
    return NumberRange_1.default.findOne({
        scope: "master",
        isActive: true,
        isExhausted: false,
    }).sort({ createdAt: 1 });
});
const allocateConsignmentNumber = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const range = yield findAvailableRange(userId);
        if (!range) {
            throw new Error(exports.NO_CONSIGNMENT_NUMBERS_ERROR);
        }
        const candidate = range.nextNumber;
        if (candidate > range.rangeEnd) {
            yield NumberRange_1.default.updateOne({ _id: range._id, nextNumber: candidate }, { $set: { isExhausted: true } });
            continue;
        }
        // A deleted number may create a gap behind nextNumber. Skip numbers that
        // are still in use before reserving the next candidate.
        const alreadyUsed = yield bilty_1.default.exists({ consignmentNo: candidate });
        if (alreadyUsed) {
            const skipped = yield NumberRange_1.default.findOneAndUpdate({
                _id: range._id,
                nextNumber: candidate,
                isActive: true,
                isExhausted: false,
            }, { $inc: { nextNumber: 1 } }, { new: true });
            if (skipped && skipped.nextNumber > skipped.rangeEnd) {
                yield NumberRange_1.default.updateOne({ _id: skipped._id, nextNumber: skipped.nextNumber }, { $set: { isExhausted: true } });
            }
            continue;
        }
        const updated = yield NumberRange_1.default.findOneAndUpdate({
            _id: range._id,
            nextNumber: candidate,
            isActive: true,
            isExhausted: false,
        }, { $inc: { nextNumber: 1 } }, { new: true });
        if (!updated) {
            continue;
        }
        if (updated.nextNumber > updated.rangeEnd) {
            yield NumberRange_1.default.updateOne({ _id: updated._id, nextNumber: updated.nextNumber }, { $set: { isExhausted: true } });
        }
        return candidate;
    }
    throw new Error(exports.NO_CONSIGNMENT_NUMBERS_ERROR);
});
exports.allocateConsignmentNumber = allocateConsignmentNumber;
const resetRangeToFirstAvailable = (rangeId) => __awaiter(void 0, void 0, void 0, function* () {
    const range = yield NumberRange_1.default.findById(rangeId);
    if (!range) {
        return;
    }
    const usedBilties = yield bilty_1.default.find({
        consignmentNo: {
            $gte: range.rangeStart,
            $lte: range.rangeEnd,
        },
    })
        .select("consignmentNo")
        .lean();
    const usedNumbers = new Set(usedBilties
        .map((bilty) => bilty.consignmentNo)
        .filter((number) => typeof number === "number"));
    let nextNumber = range.rangeStart;
    while (nextNumber <= range.rangeEnd && usedNumbers.has(nextNumber)) {
        nextNumber += 1;
    }
    range.nextNumber = nextNumber;
    range.isExhausted = nextNumber > range.rangeEnd;
    yield range.save();
});
exports.resetRangeToFirstAvailable = resetRangeToFirstAvailable;
