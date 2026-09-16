"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../../config/db");
// FR-1.1: bcrypt salt factor >= 12
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_neighborgrid_key_2026";
// FR-1.2: short-lived access token (15 min)
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
// FR-1.2: refresh token validity (7 days)
const REFRESH_TOKEN_DAYS = 7;
class AuthService {
    // ─── REGISTER ──────────────────────────────────────────────
    async register(dto) {
        const existingUser = await db_1.pool.query("SELECT id FROM users WHERE email = $1", [dto.email]);
        if (existingUser.rows.length > 0) {
            throw new Error("User already exists with this email");
        }
        const hashedPassword = await bcrypt_1.default.hash(dto.password, SALT_ROUNDS);
        const role = dto.role || "BORROWER";
        const result = await db_1.pool.query(`INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`, [dto.name, dto.email, hashedPassword, role]);
        const user = result.rows[0];
        const tokens = await this.generateTokenPair({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        return { user, ...tokens };
    }
    // ─── LOGIN ─────────────────────────────────────────────────
    async login(dto) {
        const result = await db_1.pool.query("SELECT id, name, email, phone_number, password_hash, role FROM users WHERE email = $1", [dto.email]);
        if (result.rows.length === 0) {
            throw new Error("Invalid email or password");
        }
        const user = result.rows[0];
        const isPasswordValid = await bcrypt_1.default.compare(dto.password, user.password_hash);
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
    async refreshToken(oldRefreshToken) {
        const tokenHash = this.hashToken(oldRefreshToken);
        const result = await db_1.pool.query(`SELECT rt.id, rt.user_id, rt.expires_at, u.email, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`, [tokenHash]);
        if (result.rows.length === 0) {
            throw new Error("Invalid refresh token");
        }
        const row = result.rows[0];
        // Check expiry
        if (new Date(row.expires_at) < new Date()) {
            // Clean up expired token
            await db_1.pool.query("DELETE FROM refresh_tokens WHERE id = $1", [row.id]);
            throw new Error("Refresh token expired");
        }
        // Delete old token (rotation)
        await db_1.pool.query("DELETE FROM refresh_tokens WHERE id = $1", [row.id]);
        // Issue new pair
        return this.generateTokenPair({
            userId: row.user_id,
            email: row.email,
            role: row.role,
        });
    }
    // ─── LOGOUT ────────────────────────────────────────────────
    async logout(refreshToken) {
        const tokenHash = this.hashToken(refreshToken);
        await db_1.pool.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [
            tokenHash,
        ]);
    }
    // ─── HELPERS ───────────────────────────────────────────────
    generateAccessToken(payload) {
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
            expiresIn: JWT_ACCESS_EXPIRES_IN,
        });
    }
    async generateTokenPair(payload) {
        const accessToken = this.generateAccessToken(payload);
        // Generate cryptographically secure refresh token
        const refreshToken = crypto_1.default.randomBytes(64).toString("hex");
        const tokenHash = this.hashToken(refreshToken);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
        // Persist hashed refresh token in DB
        await db_1.pool.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`, [payload.userId, tokenHash, expiresAt.toISOString()]);
        return { accessToken, refreshToken };
    }
    hashToken(token) {
        return crypto_1.default.createHash("sha256").update(token).digest("hex");
    }
}
exports.AuthService = AuthService;
