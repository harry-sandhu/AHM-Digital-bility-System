"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["superadmin", "admin", "user"],
        default: "user",
    },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});
exports.default = (0, mongoose_1.model)("User", userSchema);
