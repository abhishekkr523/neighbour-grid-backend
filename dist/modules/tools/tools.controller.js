"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsController = void 0;
const tools_service_1 = require("./tools.service");
const db_1 = require("../../config/db");
const toolsService = new tools_service_1.ToolsService();
class ToolsController {
    // POST /api/v1/tools — Create new tool listing
    async createTool(req, res) {
        try {
            const { title, description, category, price_per_day, security_deposit, address, latitude, longitude, } = req.body;
            if (!title ||
                !price_per_day ||
                !security_deposit ||
                !address ||
                latitude === undefined ||
                longitude === undefined) {
                return res.status(400).json({
                    error: "title, price_per_day, security_deposit, address, latitude, and longitude are required",
                });
            }
            const tool = await toolsService.createTool(req.user.userId, {
                title,
                description,
                category,
                price_per_day,
                security_deposit,
                address,
                latitude,
                longitude,
            });
            return res
                .status(201)
                .json({ message: "Tool listed successfully", tool });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // GET /api/v1/tools/search — Public spatial search
    async searchTools(req, res) {
        try {
            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);
            const radius = parseFloat(req.query.radius) || 10000;
            const category = req.query.category;
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            if (isNaN(lat) || isNaN(lng)) {
                return res
                    .status(400)
                    .json({ error: "lat and lng query parameters are required" });
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
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    // GET /api/v1/tools/nearby — Hyperlocal search (Haversine)
    async getNearbyTools(req, res) {
        try {
            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);
            const radius = parseFloat(req.query.radius) || 10; // Default 10 km
            const category = req.query.category;
            console.log("📍 NEARBY REQUEST:");
            console.log("lat:", lat);
            console.log("lng:", lng);
            console.log("radius:", radius);
            console.log("category:", category);
            // Validation
            if (isNaN(lat) || lat < -90 || lat > 90) {
                return res
                    .status(400)
                    .json({ error: "Invalid lat: must be a number between -90 and 90" });
            }
            if (isNaN(lng) || lng < -180 || lng > 180) {
                return res.status(400).json({
                    error: "Invalid lng: must be a number between -180 and 180",
                });
            }
            if (isNaN(radius) || radius <= 0) {
                return res
                    .status(400)
                    .json({ error: "Invalid radius: must be a positive number" });
            }
            const result = await toolsService.findNearbyTools(lat, lng, radius, category);
            console.log("🔍 SERVICE RESULT:", result.tools);
            console.log("🔍 TOOLS:", result.tools);
            console.log("🔍 TOOLS LENGTH:", result.tools?.length);
            return res.status(200).json({ result: result.tools });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    // GET /api/v1/tools/:id — Get tool details
    async getToolById(req, res) {
        try {
            const tool = await toolsService.getToolById(req.params.id);
            // FR-2.3: Only expose exact address if the requester has a confirmed reservation
            let showExactAddress = false;
            if (req.user) {
                // Check if user is the owner
                if (tool.owner_id === req.user.userId) {
                    showExactAddress = true;
                }
                else {
                    // Check if borrower has a confirmed/escrowed/active reservation
                    const resCheck = await db_1.pool.query(`SELECT id FROM reservations
             WHERE tool_id = $1 AND borrower_id = $2
               AND status IN ('CONFIRMED', 'ESCROWED', 'ACTIVE_IN_USE')
             LIMIT 1`, [req.params.id, req.user.userId]);
                    showExactAddress = resCheck.rows.length > 0;
                }
            }
            const response = {
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
        }
        catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }
    // GET /api/v1/tools/my-listings — Owner's tools
    async getMyListings(req, res) {
        try {
            const tools = await toolsService.getToolsByOwner(req.user.userId);
            return res.status(200).json({ tools });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    // PATCH /api/v1/tools/:id — Update tool
    async updateTool(req, res) {
        try {
            const tool = await toolsService.updateTool(req.params.id, req.user.userId, req.body);
            return res.status(200).json({ message: "Tool updated", tool });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // PATCH /api/v1/tools/:id/toggle — Toggle active status
    async toggleActive(req, res) {
        try {
            const { is_active } = req.body;
            if (is_active === undefined) {
                return res.status(400).json({ error: "is_active is required" });
            }
            const tool = await toolsService.toggleActive(req.params.id, req.user.userId, is_active);
            return res.status(200).json({ message: "Tool status updated", tool });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    // DELETE /api/v1/tools/:id — Delete tool
    async deleteTool(req, res) {
        try {
            await toolsService.deleteTool(req.params.id, req.user.userId);
            return res.status(200).json({ message: "Tool deleted successfully" });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}
exports.ToolsController = ToolsController;
