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
const findAvailableRanges = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const personal = yield NumberRange_1.default.find({
        scope: "personal",
        userId,
        isActive: true,
    }).sort({ createdAt: 1 });
    const master = yield NumberRange_1.default.find({
        scope: "master",
        isActive: true,
    }).sort({ createdAt: 1 });
    return [...personal, ...master];
});
const getUsedNumbers = (rangeStart, rangeEnd) => __awaiter(void 0, void 0, void 0, function* () {
    const usedBilties = yield bilty_1.default.find({
        consignmentNo: { $gte: rangeStart, $lte: rangeEnd },
    })
        .select("consignmentNo")
        .lean();
    return new Set(usedBilties
        .map((bilty) => bilty.consignmentNo)
        .filter((number) => typeof number === "number"));
});
const allocateConsignmentNumber = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const ranges = yield findAvailableRanges(userId);
        if (!ranges.length) {
            throw new Error(exports.NO_CONSIGNMENT_NUMBERS_ERROR);
        }
        for (const range of ranges) {
            const usedNumbers = yield getUsedNumbers(range.rangeStart, range.rangeEnd);
            let candidate = range.rangeStart;
            while (candidate <= range.rangeEnd && usedNumbers.has(candidate)) {
                candidate += 1;
            }
            if (candidate > range.rangeEnd) {
                yield NumberRange_1.default.updateOne({ _id: range._id, isActive: true }, { $set: { nextNumber: candidate, isExhausted: true } });
                continue;
            }
            // Match the stored value so concurrent requests cannot reserve the same
            // range state. The next allocation will rescan the range if this loses.
            const updated = yield NumberRange_1.default.findOneAndUpdate({
                _id: range._id,
                nextNumber: range.nextNumber,
                isActive: true,
            }, {
                $set: {
                    nextNumber: candidate + 1,
                    isExhausted: candidate >= range.rangeEnd,
                },
            }, { new: true });
            if (updated) {
                return candidate;
            }
        }
    }
    throw new Error(exports.NO_CONSIGNMENT_NUMBERS_ERROR);
});
exports.allocateConsignmentNumber = allocateConsignmentNumber;
const resetRangeToFirstAvailable = (rangeId) => __awaiter(void 0, void 0, void 0, function* () {
    const range = yield NumberRange_1.default.findById(rangeId);
    if (!range) {
        return;
    }
    const usedNumbers = yield getUsedNumbers(range.rangeStart, range.rangeEnd);
    let nextNumber = range.rangeStart;
    while (nextNumber <= range.rangeEnd && usedNumbers.has(nextNumber)) {
        nextNumber += 1;
    }
    range.nextNumber = nextNumber;
    range.isExhausted = nextNumber > range.rangeEnd;
    yield range.save();
});
exports.resetRangeToFirstAvailable = resetRangeToFirstAvailable;
