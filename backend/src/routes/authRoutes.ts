import { Router } from "express";
import { body } from "express-validator";
import authMiddleware from "../middleware/auth";
import handleValidationErrors from "../middleware/validate";
import { register, login, getCurrentUser } from "../controllers/authController";

const router = Router();

const registerValidators = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("phone").isString().trim().notEmpty().withMessage("Phone is required"),
  body("password")
    .isString()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const loginValidators = [
  body("phone").isString().trim().notEmpty().withMessage("Phone is required"),
  body("password").isString().notEmpty().withMessage("Password is required"),
];

router.post("/register", registerValidators, handleValidationErrors, register);
router.post("/login", loginValidators, handleValidationErrors, login);
router.get("/me", authMiddleware, getCurrentUser);

export default router;
