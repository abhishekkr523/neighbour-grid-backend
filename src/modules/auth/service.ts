import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db";
import {
  RegisterDto,
  LoginDto,
  AuthUserPayload,
  TokenPair,
} from "./auth.types";

// FR-1.1: bcrypt salt factor >= 12
const SALT_ROUNDS = 12;
const JWT_SECRET =
  process.env.JWT_SECRET || "super_secret_neighborgrid_key_2026";
// FR-1.2: short-lived access token (15 min)
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
// FR-1.2: refresh token validity (7 days)
const REFRESH_TOKEN_DAYS = 7;

export class AuthService {
  // ─── REGISTER ──────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [dto.email]
    );
    if (existingUser.rows.length > 0) {
      throw new Error("User already exists with this email");
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const role = dto.role || "BORROWER";

    const result = await pool.query(
      `INSERT INTO users (name, email, phone_number, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone_number, role, created_at`,
      [dto.name, dto.email, dto.phone_number || null, hashedPassword, role]
    );

    const user = result.rows[0];
    const tokens = await this.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, ...tokens };
  }

  // ─── LOGIN ─────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const result = await pool.query(
      "SELECT id, name, email, phone_number, password_hash, role FROM users WHERE email = $1",
      [dto.email]
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const tokens = await this.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
      },
      ...tokens,
    };
  }

  // ─── REFRESH TOKEN ─────────────────────────────────────────
  // FR-1.2: Rotate refresh token — validate old, issue new pair
  async refreshToken(oldRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(oldRefreshToken);

    const result = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, u.email, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid refresh token");
    }

    const row = result.rows[0];

    // Check expiry
    if (new Date(row.expires_at) < new Date()) {
      // Clean up expired token
      await pool.query("DELETE FROM refresh_tokens WHERE id = $1", [row.id]);
      throw new Error("Refresh token expired");
    }

    // Delete old token (rotation)
    await pool.query("DELETE FROM refresh_tokens WHERE id = $1", [row.id]);

    // Issue new pair
    return this.generateTokenPair({
      userId: row.user_id,
      email: row.email,
      role: row.role,
    });
  }

  // ─── LOGOUT ────────────────────────────────────────────────
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await pool.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [
      tokenHash,
    ]);
  }

  // ─── HELPERS ───────────────────────────────────────────────
  private generateAccessToken(payload: AuthUserPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRES_IN as string,
    } as jwt.SignOptions);
  }

  private async generateTokenPair(
    payload: AuthUserPayload
  ): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(payload);

    // Generate cryptographically secure refresh token
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    );

    // Persist hashed refresh token in DB
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [payload.userId, tokenHash, expiresAt.toISOString()]
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
