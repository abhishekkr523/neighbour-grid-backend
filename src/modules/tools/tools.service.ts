import { pool } from "../../config/db";
import { CreateToolDto, SearchToolsDto } from "./tools.types";

export class ToolsService {
  // ─── FR-2.1 + FR-2.2: CREATE TOOL LISTING ─────────────────
  async createTool(ownerId: string, dto: CreateToolDto) {
    const result = await pool.query(
      `INSERT INTO tools (owner_id, title, description, category, price_per_day, security_deposit, address, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography)
       RETURNING id, owner_id, title, description, category, price_per_day, security_deposit, address, is_active, created_at,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [
        ownerId,
        dto.title,
        dto.description || null,
        dto.category || null,
        dto.price_per_day,
        dto.security_deposit,
        dto.address,
        dto.longitude, // ST_MakePoint takes (lng, lat)
        dto.latitude,
      ]
    );
    return result.rows[0];
  }

  // ─── FR-2.4: RADIUS-BASED SPATIAL SEARCH ──────────────────
  // FR-2.3: Returns approximate location (snapped to ~200m grid)
  async searchTools(dto: SearchToolsDto) {
    const radius = Math.min(dto.radius || 10000, 50000); // Cap at 50km
    const limit = Math.min(dto.limit || 20, 100);
    const offset = ((dto.page || 1) - 1) * limit;

    let categoryFilter = "";
    const params: any[] = [dto.lng, dto.lat, radius, limit, offset];

    if (dto.category) {
      categoryFilter = "AND t.category = $6";
      params.push(dto.category);
    }

    const result = await pool.query(
      `SELECT
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
       LIMIT $4 OFFSET $5`,
      params
    );

    // Get total count for pagination
    const countParams: any[] = [dto.lng, dto.lat, radius];
    let countCategoryFilter = "";
    if (dto.category) {
      countCategoryFilter = "AND t.category = $4";
      countParams.push(dto.category);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM tools t
       WHERE t.is_active = TRUE
         AND ST_DWithin(t.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
         ${countCategoryFilter}`,
      countParams
    );

    return {
      tools: result.rows.map((row: any) => ({
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

  // ─── GET TOOL BY ID ────────────────────────────────────────
  // Returns full detail; exact address only shown to requesters
  // with a confirmed reservation (controller checks this).
  async getToolById(toolId: string) {
    const result = await pool.query(
      `SELECT
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
       WHERE t.id = $1`,
      [toolId]
    );

    if (result.rows.length === 0) {
      throw new Error("Tool not found");
    }

    return result.rows[0];
  }

  // ─── OWNER'S OWN LISTINGS ─────────────────────────────────
  async getToolsByOwner(ownerId: string) {
    const result = await pool.query(
      `SELECT id, title, description, category, price_per_day, security_deposit,
              address, is_active, created_at,
              ST_Y(location::geometry) AS latitude,
              ST_X(location::geometry) AS longitude
       FROM tools
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [ownerId]
    );
    return result.rows;
  }

  // ─── UPDATE TOOL ───────────────────────────────────────────
  async updateTool(
    toolId: string,
    ownerId: string,
    updates: Partial<CreateToolDto>
  ) {
    // Build dynamic SET clause
    const setClauses: string[] = [];
    const params: any[] = [];
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
    if (
      updates.latitude !== undefined &&
      updates.longitude !== undefined &&
      updates.address !== undefined
    ) {
      setClauses.push(`address = $${paramIndex++}`);
      params.push(updates.address);
      setClauses.push(
        `location = ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}), 4326)::geography`
      );
      params.push(updates.longitude, updates.latitude);
    }

    if (setClauses.length === 0) {
      throw new Error("No fields to update");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(toolId, ownerId);

    const result = await pool.query(
      `UPDATE tools SET ${setClauses.join(", ")}
       WHERE id = $${paramIndex++} AND owner_id = $${paramIndex}
       RETURNING id, title, description, category, price_per_day, security_deposit, address, is_active, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error("Tool not found or not owned by you");
    }
    return result.rows[0];
  }

  // ─── TOGGLE ACTIVE STATUS ─────────────────────────────────
  async toggleActive(toolId: string, ownerId: string, isActive: boolean) {
    const result = await pool.query(
      `UPDATE tools SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING id, is_active`,
      [isActive, toolId, ownerId]
    );
    if (result.rows.length === 0) {
      throw new Error("Tool not found or not owned by you");
    }
    return result.rows[0];
  }

  // ─── DELETE TOOL ──────────────────────────────────────────
  async deleteTool(toolId: string, ownerId: string) {
    // Check if there are active reservations first (optional logic, but good practice)
    // For now, simple delete if owned by the user.
    const result = await pool.query(
      `DELETE FROM tools WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [toolId, ownerId]
    );
    if (result.rows.length === 0) {
      throw new Error("Tool not found or not owned by you");
    }
    return true;
  }
}
