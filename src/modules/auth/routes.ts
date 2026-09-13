import { Router } from "express";
import { AuthController } from "./auth.controller";

const router = Router();
const authController = new AuthController();

// POST /api/v1/auth/register
router.post("/register", (req, res) => authController.register(req, res));

// POST /api/v1/auth/login
router.post("/login", (req, res) => authController.login(req, res));

// POST /api/v1/auth/refresh
router.post("/refresh", (req, res) => authController.refresh(req, res));

// POST /api/v1/auth/logout
router.post("/logout", (req, res) => authController.logout(req, res));

export default router;
