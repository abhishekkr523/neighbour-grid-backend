import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { EscrowService } from "./escrow.service";

const escrowService = new EscrowService();

export class EscrowController {
  // POST /api/v1/reservations/:id/hold — Authorize escrow payment
  async createHold(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await escrowService.createPaymentHold(
        req.params.id as string,
        req.user!.userId
      );

      return res.status(200).json({
        message: "Payment hold created successfully",
        ...result,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // POST /api/v1/reservations/:id/settle — Manual settlement (admin/testing)
  async settle(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await escrowService.settleEscrow(req.params.id as string);
      return res.status(200).json({
        message: "Escrow settled successfully",
        settlement: result,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
