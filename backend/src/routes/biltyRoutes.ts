import { Router } from "express";
import {
  generateBilty,
  updateBilty,
  getAllBilty,
} from "../controllers/biltyController";
import authMiddleware from "../middleware/auth";

const router = Router();

router.get("/generate", authMiddleware, generateBilty);
router.put("/:id", authMiddleware, updateBilty);
router.get("/all", authMiddleware, getAllBilty);

export default router;
