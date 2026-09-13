import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { DisputesService } from "./disputes.service";

const disputesService = new DisputesService();

export class DisputesController {
  // POST /api/v1/reservations/:id/dispute — File dispute (owner only)
  async fileDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const { reason, evidence_urls } = req.body;

      if (!reason) {
        return res
          .status(400)
          .json({ error: "reason is required to file a dispute" });
      }

      const dispute = await disputesService.fileDispute(req.user!.userId, {
        reservation_id: req.params.id as string,
        reason,
        evidence_urls,
      });

      return res.status(201).json({
        message: "Dispute filed — deposit frozen pending admin review",
        dispute,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // GET /api/v1/disputes/:id — Get dispute details (admin)
  async getDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await disputesService.getDisputeById(req.params.id as string);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // GET /api/v1/disputes — List all disputes (admin)
  async listDisputes(req: AuthenticatedRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      const disputes = await disputesService.listDisputes(status);
      return res.status(200).json({ disputes });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/v1/disputes/:id/resolve — Admin resolves dispute
  async resolveDispute(req: AuthenticatedRequest, res: Response) {
    try {
      const { resolution, admin_notes } = req.body;

      if (
        !resolution ||
        !["RESOLVED_OWNER", "RESOLVED_BORROWER"].includes(resolution)
      ) {
        return res.status(400).json({
          error: "resolution must be RESOLVED_OWNER or RESOLVED_BORROWER",
        });
      }

      const dispute = await disputesService.resolveDispute(
        req.params.id as string,
        req.user!.userId,
        { resolution, admin_notes }
      );

      return res
        .status(200)
        .json({ message: "Dispute resolved", dispute });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
