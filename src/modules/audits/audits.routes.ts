import { Router } from "express";
import { AuditsController } from "./audits.controller";
import { authenticate } from "../../middleware/authenticate";

const router = Router();
const auditsController = new AuditsController();

// All audit routes require authentication
router.use(authenticate);

// POST /api/v1/audits — Upload audit image record
router.post("/", (req, res) => auditsController.createAudit(req, res));

// POST /api/v1/audits/presign — Get presigned upload URL
router.post("/presign", (req, res) =>
  auditsController.getPresignedUrl(req, res)
);

export default router;
