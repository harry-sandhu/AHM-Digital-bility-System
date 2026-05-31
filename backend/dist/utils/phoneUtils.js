"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPhoneLengthValid = exports.normalizePhone = void 0;
const normalizePhone = (value) => value.replace(/\D/g, "");
exports.normalizePhone = normalizePhone;
const isPhoneLengthValid = (value) => value.length >= 10 && value.length <= 15;
exports.isPhoneLengthValid = isPhoneLengthValid;
