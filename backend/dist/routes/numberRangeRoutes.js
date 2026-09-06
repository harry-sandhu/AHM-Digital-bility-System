"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("../middleware/auth"));
const authorize_1 = __importDefault(require("../middleware/authorize"));
const numberRangeController_1 = require("../controllers/numberRangeController");
const router = (0, express_1.Router)();
router.post("/", auth_1.default, (0, authorize_1.default)("superadmin"), numberRangeController_1.createRange);
router.get("/", auth_1.default, (0, authorize_1.default)("superadmin"), numberRangeController_1.listRanges);
router.patch("/:id", auth_1.default, (0, authorize_1.default)("superadmin"), numberRangeController_1.updateRange);
router.delete("/:id", auth_1.default, (0, authorize_1.default)("superadmin"), numberRangeController_1.deleteRange);
exports.default = router;
