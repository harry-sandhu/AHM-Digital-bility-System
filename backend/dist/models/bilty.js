"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const biltySchema = new mongoose_1.Schema({
    biltyNumber: { type: String, required: true, unique: true },
    consignmentNo: { type: Number, unique: true, sparse: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    formData: Object,
    status: { type: String, enum: ["draft", "expired"], default: "draft" },
    paymentAmount: { type: Number, default: 0 },
    paymentPaidAt: { type: Date },
    paymentExpiresAt: { type: Date },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
});
exports.default = (0, mongoose_1.model)("Bilty", biltySchema);
