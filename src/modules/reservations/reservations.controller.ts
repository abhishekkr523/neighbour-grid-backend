import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { ReservationsService } from "./reservations.service";

const reservationsService = new ReservationsService();

export class ReservationsController {
  // POST /api/v1/reservations — Create reservation
  async create(req: AuthenticatedRequest, res: Response) {
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

      const reservation = await reservationsService.createReservation(
        req.user!.userId,
        { tool_id, start_date, end_date }
      );

      return res
        .status(201)
        .json({ message: "Reservation created", reservation });
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({ error: error.message });
    }
  }

  // PATCH /api/v1/reservations/:id/accept — Owner accepts
  async accept(req: AuthenticatedRequest, res: Response) {
    try {
      const reservation = await reservationsService.acceptReservation(
        req.params.id as string,
        req.user!.userId
      );
      return res
        .status(200)
        .json({ message: "Reservation accepted", reservation });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // PATCH /api/v1/reservations/:id/decline — Owner declines
  async decline(req: AuthenticatedRequest, res: Response) {
    try {
      const reservation = await reservationsService.declineReservation(
        req.params.id as string,
        req.user!.userId
      );
      return res
        .status(200)
        .json({ message: "Reservation declined", reservation });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // GET /api/v1/reservations — List user's reservations
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const role = (req.query.role as "borrower" | "owner") || "borrower";
      const reservations = await reservationsService.getReservationsByUser(
        req.user!.userId,
        role
      );
      return res.status(200).json({ reservations });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/reservations/:id — Get reservation details
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const reservation = await reservationsService.getReservationById(
        req.params.id as string,
        req.user!.userId
      );
      return res.status(200).json({ reservation });
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // GET /api/v1/tools/:toolId/availability — Unavailable dates
  async getAvailability(req: AuthenticatedRequest, res: Response) {
    try {
      const dates = await reservationsService.getUnavailableDates(
        req.params.toolId as string
      );
      return res.status(200).json({ unavailable_dates: dates });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/v1/reservations/:id/return — Mark returned
  async markReturned(req: AuthenticatedRequest, res: Response) {
    try {
      const reservation = await reservationsService.markReturned(
        req.params.id as string,
        req.user!.userId
      );
      return res
        .status(200)
        .json({ message: "Item marked as returned", reservation });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
