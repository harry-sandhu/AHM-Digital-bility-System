"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const numberRangeSchema = new mongoose_1.Schema({
    label: { type: String, trim: true },
    scope: { type: String, enum: ["master", "personal"], required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    rangeStart: { type: Number, required: true, min: 1000 },
    rangeEnd: { type: Number, required: true, min: 1000 },
    nextNumber: { type: Number, required: true },
    isExhausted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
// Only one active, non-exhausted personal range may exist per userId at a time.
// This is enforced in the controller rather than by the schema.
exports.default = (0, mongoose_1.model)("NumberRange", numberRangeSchema);
