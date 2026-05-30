"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const biltySchema = new mongoose_1.Schema({
    biltyNumber: { type: String, required: true, unique: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    formData: Object,
    createdAt: { type: Date, default: Date.now },
});
exports.default = (0, mongoose_1.model)("Bilty", biltySchema);
