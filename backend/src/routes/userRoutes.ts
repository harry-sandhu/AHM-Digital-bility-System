import { Router } from "express";
import authMiddleware from "../middleware/auth";
import authorize from "../middleware/authorize";
import {
  createAdmin,
  disableUser,
  getAllUsers,
} from "../controllers/userController";

const router = Router();

router.get("/", authMiddleware, authorize("superadmin", "admin"), getAllUsers);
router.post("/admins", authMiddleware, authorize("superadmin"), createAdmin);
router.patch(
  "/:id/disable",
  authMiddleware,
  authorize("superadmin"),
  disableUser
);

export default router;
