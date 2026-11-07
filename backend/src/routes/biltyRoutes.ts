import { Router } from "express";
import multer from "multer";
import {
  generateBilty,
  purchaseBiltyAccess,
  updateBilty,
  getBiltyById,
  getAllBilty,
  getMyBilty,
  deleteBilty,
  extractBillData,
} from "../controllers/biltyController";
import authMiddleware from "../middleware/auth";
import authorize from "../middleware/authorize";

const router = Router();

const ALLOWED_BILL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const billUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_BILL_MIME_TYPES.includes(file.mimetype)) {
      return callback(null, true);
    }

    callback(new Error("Only JPEG, PNG, WEBP images or PDF files are allowed"));
  },
});

router.post("/pay", authMiddleware, purchaseBiltyAccess);
router.post("/extract-bill", authMiddleware, billUpload.single("bill"), extractBillData);
router.get("/generate", authMiddleware, generateBilty);
router.get("/my", authMiddleware, getMyBilty);
router.get(
  "/all",
  authMiddleware,
  authorize("superadmin"),
  getAllBilty
);
router.get("/:id", authMiddleware, getBiltyById);
router.put("/:id", authMiddleware, updateBilty);
router.delete("/:id", authMiddleware, authorize("superadmin"), deleteBilty);

export default router;
