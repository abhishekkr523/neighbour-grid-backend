"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsController = void 0;
const reservations_service_1 = require("./reservations.service");
const reservationsService = new reservations_service_1.ReservationsService();
class ReservationsController {
    // POST /api/v1/reservations — Create reservation
    async create(req, res) {
        try {
            const { tool_id, start_date, end_date } = req.body;
            if (!tool_id || !start_date || !end_date) {
                return res
                    .status(400)
                    .json({ error: "tool_id, start_date, and end_date are required" });
            }
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
                return res
                    .status(400)
                    .json({ error: "Dates must be in YYYY-MM-DD format" });
            }
            const reservation = await reservationsService.createReservation(req.user.userId, { tool_id, start_date, end_date });
            return res
                .status(201)
                .json({ message: "Reservation created", reservation });
        }
        catch (error) {
            const statusCode = error.statusCode || 400;
            return res.status(statusCode).json({ error: error.message });
        }
    }
    // PATCH /api/v1/reservations/:id/accept — Owner accepts
    async accept(req, res) {
        try {
            const reservation = await reservationsService.acceptReservation(req.params.id, req.user.userId);
            return res
                .status(200)
                .json({ message: "Reservation accepted", reservation });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // PATCH /api/v1/reservations/:id/decline — Owner declines
    async decline(req, res) {
        try {
            const reservation = await reservationsService.declineReservation(req.params.id, req.user.userId);
            return res
                .status(200)
                .json({ message: "Reservation declined", reservation });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // GET /api/v1/reservations — List user's reservations
    async list(req, res) {
        try {
            const role = req.query.role || "borrower";
            const reservations = await reservationsService.getReservationsByUser(req.user.userId, role);
            return res.status(200).json({ reservations });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    // GET /api/v1/reservations/:id — Get reservation details
    async getById(req, res) {
        try {
            const reservation = await reservationsService.getReservationById(req.params.id, req.user.userId);
            return res.status(200).json({ reservation });
        }
        catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }
    // GET /api/v1/tools/:toolId/availability — Unavailable dates
    async getAvailability(req, res) {
        try {
            const dates = await reservationsService.getUnavailableDates(req.params.toolId);
            return res.status(200).json({ unavailable_dates: dates });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    // PATCH /api/v1/reservations/:id/return — Mark returned
    async markReturned(req, res) {
        try {
            const reservation = await reservationsService.markReturned(req.params.id, req.user.userId);
            return res
                .status(200)
                .json({ message: "Item marked as returned", reservation });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}
exports.ReservationsController = ReservationsController;
