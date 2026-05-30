import { Router } from "express";
import {
  generateBilty,
  updateBilty,
  getAllBilty,
  getMyBilty,
} from "../controllers/biltyController";
import authMiddleware from "../middleware/auth";
import authorize from "../middleware/authorize";

const router = Router();

router.get("/generate", authMiddleware, generateBilty);
router.get("/my", authMiddleware, getMyBilty);
router.get(
  "/all",
  authMiddleware,
  authorize("superadmin", "admin"),
  getAllBilty
);
router.put("/:id", authMiddleware, updateBilty);

export default router;
