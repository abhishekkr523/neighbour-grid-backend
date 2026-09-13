import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { ToolsService } from "./tools.service";
import { pool } from "../../config/db";
import { Request } from "express";

const toolsService = new ToolsService();

export class ToolsController {
  // POST /api/v1/tools — Create new tool listing
  async createTool(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        title,
        description,
        category,
        price_per_day,
        security_deposit,
        address,
        latitude,
        longitude,
      } = req.body;

      if (!title || !price_per_day || !security_deposit || !address || latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          error: "title, price_per_day, security_deposit, address, latitude, and longitude are required",
        });
      }

      const tool = await toolsService.createTool(req.user!.userId, {
        title,
        description,
        category,
        price_per_day,
        security_deposit,
        address,
        latitude,
        longitude,
      });

      return res.status(201).json({ message: "Tool listed successfully", tool });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // GET /api/v1/tools/search — Public spatial search
  async searchTools(req: Request, res: Response) {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 10000;
      const category = req.query.category as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat and lng query parameters are required" });
      }

      const result = await toolsService.searchTools({
        lat,
        lng,
        radius,
        category,
        page,
        limit,
      });

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/tools/:id — Get tool details
  async getToolById(req: AuthenticatedRequest, res: Response) {
    try {
      const tool = await toolsService.getToolById(req.params.id as string);

      // FR-2.3: Only expose exact address if the requester has a confirmed reservation
      let showExactAddress = false;

      if (req.user) {
        // Check if user is the owner
        if (tool.owner_id === req.user.userId) {
          showExactAddress = true;
        } else {
          // Check if borrower has a confirmed/escrowed/active reservation
          const resCheck = await pool.query(
            `SELECT id FROM reservations
             WHERE tool_id = $1 AND borrower_id = $2
               AND status IN ('CONFIRMED', 'ESCROWED', 'ACTIVE_IN_USE')
             LIMIT 1`,
            [req.params.id as string, req.user.userId]
          );
          showExactAddress = resCheck.rows.length > 0;
        }
      }

      const response: any = {
        id: tool.id,
        owner_id: tool.owner_id,
        title: tool.title,
        description: tool.description,
        category: tool.category,
        price_per_day: tool.price_per_day,
        security_deposit: tool.security_deposit,
        is_active: tool.is_active,
        created_at: tool.created_at,
        approximate_lat: parseFloat(tool.approximate_lat),
        approximate_lng: parseFloat(tool.approximate_lng),
        owner_name: tool.owner_name,
        owner_rating_avg: parseFloat(tool.owner_rating_avg),
      };

      if (showExactAddress) {
        response.address = tool.address;
        response.exact_lat = parseFloat(tool.latitude);
        response.exact_lng = parseFloat(tool.longitude);
      }

      return res.status(200).json({ tool: response });
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  // GET /api/v1/tools/my-listings — Owner's tools
  async getMyListings(req: AuthenticatedRequest, res: Response) {
    try {
      const tools = await toolsService.getToolsByOwner(req.user!.userId);
      return res.status(200).json({ tools });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // PATCH /api/v1/tools/:id — Update tool
  async updateTool(req: AuthenticatedRequest, res: Response) {
    try {
      const tool = await toolsService.updateTool(
        req.params.id as string,
        req.user!.userId,
        req.body
      );
      return res.status(200).json({ message: "Tool updated", tool });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // PATCH /api/v1/tools/:id/toggle — Toggle active status
  async toggleActive(req: AuthenticatedRequest, res: Response) {
    try {
      const { is_active } = req.body;
      if (is_active === undefined) {
        return res.status(400).json({ error: "is_active is required" });
      }
      const tool = await toolsService.toggleActive(
        req.params.id as string,
        req.user!.userId,
        is_active
      );
      return res.status(200).json({ message: "Tool status updated", tool });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  // DELETE /api/v1/tools/:id — Delete tool
  async deleteTool(req: AuthenticatedRequest, res: Response) {
    try {
      await toolsService.deleteTool(req.params.id as string, req.user!.userId);
      return res.status(200).json({ message: "Tool deleted successfully" });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
