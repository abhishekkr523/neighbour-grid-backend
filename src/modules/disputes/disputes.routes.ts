import { Router } from "express";
import { DisputesController } from "./disputes.controller";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";

const router = Router();
const disputesController = new DisputesController();

// All dispute routes require authentication
router.use(authenticate);

// GET /api/v1/disputes — List all disputes (admin only)
router.get("/", authorize(["ADMIN"]), (req, res) =>
  disputesController.listDisputes(req, res)
);

// GET /api/v1/disputes/:id — Get dispute details with side-by-side audits (admin only)
router.get("/:id", authorize(["ADMIN"]), (req, res) =>
  disputesController.getDispute(req, res)
);

// PATCH /api/v1/disputes/:id/resolve — Admin resolves dispute
router.patch("/:id/resolve", authorize(["ADMIN"]), (req, res) =>
  disputesController.resolveDispute(req, res)
);

export default router;
