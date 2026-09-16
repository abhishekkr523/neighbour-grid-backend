import { Router } from "express";
import { ToolsController } from "./tools.controller";
import { authenticate } from "../../middleware/authenticate";

const router = Router();
const toolsController = new ToolsController();

// Public routes
// GET /api/v1/tools/search — Spatial search (no auth required)
router.get("/search", (req, res) => toolsController.searchTools(req, res));

// GET /api/v1/tools/nearby — Hyperlocal search (Haversine)
router.get("/nearby", (req, res) => toolsController.getNearbyTools(req, res));

// Authenticated routes
// GET /api/v1/tools/my-listings — Owner's own tools
router.get("/my-listings", authenticate, (req, res) =>
  toolsController.getMyListings(req, res)
);

// GET /api/v1/tools/:id — Tool details (optional auth for address reveal)
router.get("/:id", (req, res, next) => {
  // Optional authentication — try to decode token but don't fail
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authenticate(req, res, next);
  }
  next();
}, (req, res) => toolsController.getToolById(req, res));

// POST /api/v1/tools — Create new listing
router.post("/", authenticate, (req, res) =>
  toolsController.createTool(req, res)
);

// PATCH /api/v1/tools/:id — Update listing
router.patch("/:id", authenticate, (req, res) =>
  toolsController.updateTool(req, res)
);

// PATCH /api/v1/tools/:id/toggle — Toggle active status
router.patch("/:id/toggle", authenticate, (req, res) =>
  toolsController.toggleActive(req, res)
);

// Delete tool
router.delete(
  "/:id",
  authenticate,
  (req, res) => toolsController.deleteTool(req, res)
);

export default router;
