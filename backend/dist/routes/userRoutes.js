"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("../middleware/auth"));
const authorize_1 = __importDefault(require("../middleware/authorize"));
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
router.get("/", auth_1.default, (0, authorize_1.default)("superadmin", "admin"), userController_1.getAllUsers);
router.post("/admins", auth_1.default, (0, authorize_1.default)("superadmin"), userController_1.createAdmin);
router.patch("/:id/disable", auth_1.default, (0, authorize_1.default)("superadmin"), userController_1.disableUser);
exports.default = router;
