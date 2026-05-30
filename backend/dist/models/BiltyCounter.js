"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const biltyCounterSchema = new mongoose_1.Schema({
    prefix: { type: String, required: true, unique: true },
    counter: { type: Number, default: 0 },
});
exports.default = (0, mongoose_1.model)("BiltyCounter", biltyCounterSchema);
