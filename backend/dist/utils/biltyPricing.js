"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBiltyAccessAmount = void 0;
const getBiltyAccessAmount = (freightAmount) => {
    if (freightAmount <= 10000) {
        return 200;
    }
    if (freightAmount <= 30000) {
        return 300;
    }
    if (freightAmount <= 50000) {
        return 400;
    }
    return 500;
};
exports.getBiltyAccessAmount = getBiltyAccessAmount;
