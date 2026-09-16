"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
// POST /api/v1/auth/register
router.post("/register", (req, res) => authController.register(req, res));
// POST /api/v1/auth/login
router.post("/login", (req, res) => authController.login(req, res));
// POST /api/v1/auth/refresh
router.post("/refresh", (req, res) => authController.refresh(req, res));
// POST /api/v1/auth/logout
router.post("/logout", (req, res) => authController.logout(req, res));
exports.default = router;
