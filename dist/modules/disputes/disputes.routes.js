"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const disputes_controller_1 = require("./disputes.controller");
const authenticate_1 = require("../../middleware/authenticate");
const authorize_1 = require("../../middleware/authorize");
const router = (0, express_1.Router)();
const disputesController = new disputes_controller_1.DisputesController();
// All dispute routes require authentication
router.use(authenticate_1.authenticate);
// GET /api/v1/disputes — List all disputes (admin only)
router.get("/", (0, authorize_1.authorize)(["ADMIN"]), (req, res) => disputesController.listDisputes(req, res));
// GET /api/v1/disputes/:id — Get dispute details with side-by-side audits (admin only)
router.get("/:id", (0, authorize_1.authorize)(["ADMIN"]), (req, res) => disputesController.getDispute(req, res));
// PATCH /api/v1/disputes/:id/resolve — Admin resolves dispute
router.patch("/:id/resolve", (0, authorize_1.authorize)(["ADMIN"]), (req, res) => disputesController.resolveDispute(req, res));
exports.default = router;
