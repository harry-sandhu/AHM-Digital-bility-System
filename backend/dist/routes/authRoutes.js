"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = __importDefault(require("../middleware/auth"));
const validate_1 = __importDefault(require("../middleware/validate"));
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
const registerValidators = [
    (0, express_validator_1.body)("name").trim().notEmpty().withMessage("Name is required"),
    (0, express_validator_1.body)("phone").isString().trim().notEmpty().withMessage("Phone is required"),
    (0, express_validator_1.body)("password")
        .isString()
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters"),
];
const loginValidators = [
    (0, express_validator_1.body)("phone").isString().trim().notEmpty().withMessage("Phone is required"),
    (0, express_validator_1.body)("password").isString().notEmpty().withMessage("Password is required"),
];
router.post("/register", registerValidators, validate_1.default, authController_1.register);
router.post("/login", loginValidators, validate_1.default, authController_1.login);
router.get("/me", auth_1.default, authController_1.getCurrentUser);
exports.default = router;
