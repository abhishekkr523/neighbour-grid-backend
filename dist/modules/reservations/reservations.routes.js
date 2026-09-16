"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reservations_controller_1 = require("./reservations.controller");
const authenticate_1 = require("../../middleware/authenticate");
const router = (0, express_1.Router)();
const reservationsController = new reservations_controller_1.ReservationsController();
// All reservation routes require authentication
router.use(authenticate_1.authenticate);
// POST /api/v1/reservations — Create reservation
router.post("/", (req, res) => reservationsController.create(req, res));
// GET /api/v1/reservations — List user's reservations
router.get("/", (req, res) => reservationsController.list(req, res));
// GET /api/v1/reservations/:id — Get reservation details
router.get("/:id", (req, res) => reservationsController.getById(req, res));
// PATCH /api/v1/reservations/:id/accept — Owner accepts
router.patch("/:id/accept", (req, res) => reservationsController.accept(req, res));
// PATCH /api/v1/reservations/:id/decline — Owner declines
router.patch("/:id/decline", (req, res) => reservationsController.decline(req, res));
// PATCH /api/v1/reservations/:id/return — Mark returned
router.patch("/:id/return", (req, res) => reservationsController.markReturned(req, res));
exports.default = router;
