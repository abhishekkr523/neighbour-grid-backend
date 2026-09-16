"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsService = void 0;
const db_1 = require("../../config/db");
class ToolsService {
    // ─── FR-2.1 + FR-2.2: CREATE TOOL LISTING ─────────────────
    async createTool(ownerId, dto) {
        const result = await db_1.pool.query(`INSERT INTO tools (owner_id, title, description, category, price_per_day, security_deposit, address, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography)
       RETURNING id, owner_id, title, description, category, price_per_day, security_deposit, address, is_active, created_at,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`, [
            ownerId,
            dto.title,
            dto.description || null,
            dto.category || null,
            dto.price_per_day,
            dto.security_deposit,
            dto.address,
            dto.longitude, // ST_MakePoint takes (lng, lat)
            dto.latitude,
        ]);
        return result.rows[0];
    }
    // ─── FR-2.4: RADIUS-BASED SPATIAL SEARCH ──────────────────
    // FR-2.3: Returns approximate location (snapped to ~200m grid)
    async searchTools(dto) {
        const radius = Math.min(dto.radius || 10000, 50000); // Cap at 50km
        const limit = Math.min(dto.limit || 20, 100);
        const offset = ((dto.page || 1) - 1) * limit;
        let categoryFilter = "";
        const params = [dto.lng, dto.lat, radius, limit, offset];
        if (dto.category) {
            categoryFilter = "AND t.category = $6";
            params.push(dto.category);
        }
        const result = await db_1.pool.query(`SELECT
         t.id,
         t.owner_id,
         t.title,
         t.description,
         t.category,
         t.price_per_day,
         t.security_deposit,
         t.is_active,
         t.created_at,
         -- FR-2.3: Privacy masking — snap coordinates to ~200m grid
         ROUND(CAST(ST_Y(t.location::geometry) * 500 AS NUMERIC), 0) / 500.0 AS approximate_lat,
         ROUND(CAST(ST_X(t.location::geometry) * 500 AS NUMERIC), 0) / 500.0 AS approximate_lng,
         -- Distance in meters
         ST_Distance(t.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
       FROM tools t
       WHERE t.is_active = TRUE
         AND ST_DWithin(t.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         ${categoryFilter}
       ORDER BY distance_meters ASC
       LIMIT $4 OFFSET $5`, params);
        // Get total count for pagination
        const countParams = [dto.lng, dto.lat, radius];
        let countCategoryFilter = "";
        if (dto.category) {
            countCategoryFilter = "AND t.category = $4";
            countParams.push(dto.category);
        }
        const countResult = await db_1.pool.query(`SELECT COUNT(*) AS total
       FROM tools t
       WHERE t.is_active = TRUE
         AND ST_DWithin(t.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         ${countCategoryFilter}`, countParams);
        return {
            tools: result.rows.map((row) => ({
                ...row,
                distance_meters: Math.round(parseFloat(row.distance_meters)),
            })),
            pagination: {
                total: parseInt(countResult.rows[0].total, 10),
                page: dto.page || 1,
                limit,
            },
        };
    }
    // ─── HYPERLOCAL RADIUS SEARCH (HAVERSINE) ────────────────────
    async findNearbyTools(lat, lng, radiusKm, category) {
        const limit = 50; // Default limit
        let categoryFilter = "";
        const params = [lat, lng, radiusKm, limit];
        if (category) {
            categoryFilter = "AND category = $5";
            params.push(category);
        }
        // Haversine formula directly in PostgreSQL
        // Returns distance_km. 6371 is the Earth's radius in km.
        const query = `
      SELECT
        id, owner_id, title, description, category, price_per_day, security_deposit, is_active, created_at,
        latitude, longitude,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude))
          )
        ) AS distance_km
      FROM tools
      WHERE is_active = TRUE
        ${categoryFilter}
      HAVING (
        6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )
      ) <= $3
      ORDER BY distance_km ASC
      LIMIT $4
    `;
        // Note: PostgreSQL does not support HAVING without GROUP BY unless it's a grouped query.
        // So we use a subquery or WHERE with the formula. Since WHERE can't use alias, we use a subquery.
        const safeQuery = `
      SELECT * FROM (
        SELECT
          id, owner_id, title, description, category, price_per_day, security_deposit, is_active, created_at,
          ST_Y(location::geometry) AS latitude, 
          ST_X(location::geometry) AS longitude,
          (
            6371 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians($1)) * cos(radians(ST_Y(location::geometry))) * cos(radians(ST_X(location::geometry)) - radians($2)) +
                sin(radians($1)) * sin(radians(ST_Y(location::geometry)))
              ))
            )
          ) AS distance_km
        FROM tools
        WHERE is_active = TRUE
          ${categoryFilter}
      ) AS nearby_tools
      WHERE distance_km <= $3
      ORDER BY distance_km ASC
      LIMIT $4
    `;
        const result = await db_1.pool.query(safeQuery, params);
        return {
            tools: result.rows.map((row) => ({
                ...row,
                distance_km: parseFloat(parseFloat(row.distance_km).toFixed(2)),
            }))
        };
    }
    // ─── GET TOOL BY ID ────────────────────────────────────────
    // Returns full detail; exact address only shown to requesters
    // with a confirmed reservation (controller checks this).
    async getToolById(toolId) {
        const result = await db_1.pool.query(`SELECT
         t.id, t.owner_id, t.title, t.description, t.category,
         t.price_per_day, t.security_deposit, t.address, t.is_active, t.created_at,
         ST_Y(t.location::geometry) AS latitude,
         ST_X(t.location::geometry) AS longitude,
         ROUND(CAST(ST_Y(t.location::geometry) * 500 AS NUMERIC), 0) / 500.0 AS approximate_lat,
         ROUND(CAST(ST_X(t.location::geometry) * 500 AS NUMERIC), 0) / 500.0 AS approximate_lng,
         u.name AS owner_name,
         u.rating_avg AS owner_rating_avg
       FROM tools t
       JOIN users u ON u.id = t.owner_id
       WHERE t.id = $1`, [toolId]);
        if (result.rows.length === 0) {
            throw new Error("Tool not found");
        }
        return result.rows[0];
    }
    // ─── OWNER'S OWN LISTINGS ─────────────────────────────────
    async getToolsByOwner(ownerId) {
        const result = await db_1.pool.query(`SELECT id, title, description, category, price_per_day, security_deposit,
              address, is_active, created_at,
              ST_Y(location::geometry) AS latitude,
              ST_X(location::geometry) AS longitude
       FROM tools
       WHERE owner_id = $1
       ORDER BY created_at DESC`, [ownerId]);
        return result.rows;
    }
    // ─── UPDATE TOOL ───────────────────────────────────────────
    async updateTool(toolId, ownerId, updates) {
        // Build dynamic SET clause
        const setClauses = [];
        const params = [];
        let paramIndex = 1;
        if (updates.title !== undefined) {
            setClauses.push(`title = $${paramIndex++}`);
            params.push(updates.title);
        }
        if (updates.description !== undefined) {
            setClauses.push(`description = $${paramIndex++}`);
            params.push(updates.description);
        }
        if (updates.category !== undefined) {
            setClauses.push(`category = $${paramIndex++}`);
            params.push(updates.category);
        }
        if (updates.price_per_day !== undefined) {
            setClauses.push(`price_per_day = $${paramIndex++}`);
            params.push(updates.price_per_day);
        }
        if (updates.security_deposit !== undefined) {
            setClauses.push(`security_deposit = $${paramIndex++}`);
            params.push(updates.security_deposit);
        }
        if (updates.latitude !== undefined &&
            updates.longitude !== undefined &&
            updates.address !== undefined) {
            setClauses.push(`address = $${paramIndex++}`);
            params.push(updates.address);
            setClauses.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}), 4326)::geography`);
            params.push(updates.longitude, updates.latitude);
        }
        if (setClauses.length === 0) {
            throw new Error("No fields to update");
        }
        setClauses.push(`updated_at = NOW()`);
        params.push(toolId, ownerId);
        const result = await db_1.pool.query(`UPDATE tools SET ${setClauses.join(", ")}
       WHERE id = $${paramIndex++} AND owner_id = $${paramIndex}
       RETURNING id, title, description, category, price_per_day, security_deposit, address, is_active, updated_at`, params);
        if (result.rows.length === 0) {
            throw new Error("Tool not found or not owned by you");
        }
        return result.rows[0];
    }
    // ─── TOGGLE ACTIVE STATUS ─────────────────────────────────
    async toggleActive(toolId, ownerId, isActive) {
        const result = await db_1.pool.query(`UPDATE tools SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING id, is_active`, [isActive, toolId, ownerId]);
        if (result.rows.length === 0) {
            throw new Error("Tool not found or not owned by you");
        }
        return result.rows[0];
    }
    // ─── DELETE TOOL ──────────────────────────────────────────
    async deleteTool(toolId, ownerId) {
        // Check if there are active reservations first (optional logic, but good practice)
        // For now, simple delete if owned by the user.
        const result = await db_1.pool.query(`DELETE FROM tools WHERE id = $1 AND owner_id = $2 RETURNING id`, [toolId, ownerId]);
        if (result.rows.length === 0) {
            throw new Error("Tool not found or not owned by you");
        }
        return true;
    }
}
exports.ToolsService = ToolsService;
