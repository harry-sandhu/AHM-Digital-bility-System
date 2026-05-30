"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const biltyController_1 = require("../controllers/biltyController");
const auth_1 = __importDefault(require("../middleware/auth"));
const authorize_1 = __importDefault(require("../middleware/authorize"));
const router = (0, express_1.Router)();
router.get("/generate", auth_1.default, biltyController_1.generateBilty);
router.get("/my", auth_1.default, biltyController_1.getMyBilty);
router.get("/all", auth_1.default, (0, authorize_1.default)("superadmin", "admin"), biltyController_1.getAllBilty);
router.put("/:id", auth_1.default, biltyController_1.updateBilty);
exports.default = router;
