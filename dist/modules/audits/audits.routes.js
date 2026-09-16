"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const audits_controller_1 = require("./audits.controller");
const authenticate_1 = require("../../middleware/authenticate");
const router = (0, express_1.Router)();
const auditsController = new audits_controller_1.AuditsController();
// All audit routes require authentication
router.use(authenticate_1.authenticate);
// POST /api/v1/audits — Upload audit image record
router.post("/", (req, res) => auditsController.createAudit(req, res));
// POST /api/v1/audits/presign — Get presigned upload URL
router.post("/presign", (req, res) => auditsController.getPresignedUrl(req, res));
exports.default = router;
