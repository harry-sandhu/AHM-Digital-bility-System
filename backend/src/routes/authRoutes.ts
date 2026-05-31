import { Router } from "express";
import authMiddleware from "../middleware/auth";
import { register, login, getCurrentUser } from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getCurrentUser);

export default router;
