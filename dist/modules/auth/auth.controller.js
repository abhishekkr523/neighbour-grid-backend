"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const service_1 = require("./service");
const authService = new service_1.AuthService();
class AuthController {
    async register(req, res) {
        try {
            const { name, email, password, role } = req.body;
            if (!name || !email || !password) {
                return res
                    .status(400)
                    .json({ error: "Name, email, and password are required" });
            }
            const data = await authService.register({ name, email, password, role });
            return res
                .status(201)
                .json({ message: "User registered successfully", ...data });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res
                    .status(400)
                    .json({ error: "Email and password are required" });
            }
            const data = await authService.login({ email, password });
            return res.status(200).json({ message: "Login successful", ...data });
        }
        catch (error) {
            return res.status(401).json({ error: error.message });
        }
    }
    async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ error: "Refresh token is required" });
            }
            const data = await authService.refreshToken(refreshToken);
            return res
                .status(200)
                .json({ message: "Token refreshed successfully", ...data });
        }
        catch (error) {
            return res.status(401).json({ error: error.message });
        }
    }
    async logout(req, res) {
        try {
            console.log("Logout request received:", req.body);
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ error: "Refresh token is required" });
            }
            await authService.logout(refreshToken);
            return res.status(200).json({ message: "Logout successful" });
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
}
exports.AuthController = AuthController;
