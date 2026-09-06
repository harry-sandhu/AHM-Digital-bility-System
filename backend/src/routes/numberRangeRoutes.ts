import { Router } from "express";
import authMiddleware from "../middleware/auth";
import authorize from "../middleware/authorize";
import {
  createRange,
  deleteRange,
  listRanges,
  updateRange,
} from "../controllers/numberRangeController";

const router = Router();

router.post("/", authMiddleware, authorize("superadmin"), createRange);
router.get("/", authMiddleware, authorize("superadmin"), listRanges);
router.patch("/:id", authMiddleware, authorize("superadmin"), updateRange);
router.delete("/:id", authMiddleware, authorize("superadmin"), deleteRange);

export default router;
