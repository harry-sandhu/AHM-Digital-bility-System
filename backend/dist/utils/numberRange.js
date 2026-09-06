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
exports.allocateConsignmentNumber = exports.NO_CONSIGNMENT_NUMBERS_ERROR = void 0;
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
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const range = yield findAvailableRange(userId);
        if (!range) {
            throw new Error(exports.NO_CONSIGNMENT_NUMBERS_ERROR);
        }
        const updated = yield NumberRange_1.default.findOneAndUpdate({
            _id: range._id,
            nextNumber: { $lte: range.rangeEnd },
        }, { $inc: { nextNumber: 1 } }, { new: true });
        if (!updated) {
            continue;
        }
        const issuedNumber = updated.nextNumber - 1;
        if (updated.nextNumber > updated.rangeEnd) {
            yield NumberRange_1.default.updateOne({ _id: updated._id, nextNumber: updated.nextNumber }, { $set: { isExhausted: true } });
        }
        return issuedNumber;
    }
    throw new Error(exports.NO_CONSIGNMENT_NUMBERS_ERROR);
});
exports.allocateConsignmentNumber = allocateConsignmentNumber;
