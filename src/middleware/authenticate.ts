import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthUserPayload } from "../modules/auth/auth.types";

const JWT_SECRET =
  process.env.JWT_SECRET || "super_secret_neighborgrid_key_2026";

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid or expired token" });
  }
}
