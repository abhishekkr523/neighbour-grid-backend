import { Request, Response } from "express";
import { AuthService } from "./service";

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
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
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const data = await authService.login({ email, password });
      return res.status(200).json({ message: "Login successful", ...data });
    } catch (error: any) {
      return res.status(401).json({ error: error.message });
    }
  }
}
