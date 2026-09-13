-- ============================================================
-- NeighborGrid — Full Schema Migration (001_init.sql)
-- PostgreSQL 15+ with PostGIS 3.3+
-- ============================================================

-- Required Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('BORROWER', 'OWNER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM (
        'PENDING',
        'CONFIRMED',
        'ESCROWED',
        'ACTIVE_IN_USE',
        'RETURNED',
        'COMPLETED',
        'CANCELLED',
        'DISPUTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_type AS ENUM ('PICKUP', 'RETURN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_image_category AS ENUM ('OVERVIEW', 'WEAR_POINTS', 'SERIAL_NUMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE dispute_status AS ENUM ('OPEN', 'RESOLVED_OWNER', 'RESOLVED_BORROWER', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  UNIQUE NOT NULL,
    phone_number    VARCHAR(20),
    password_hash   VARCHAR(255)  NOT NULL,
    role            user_role     DEFAULT 'BORROWER',
    rating_avg      NUMERIC(3,2)  DEFAULT 0.00,
    rating_count    INTEGER       DEFAULT 0,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
-- 2. REFRESH TOKENS (FR-1.2)
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255)  NOT NULL,
    expires_at      TIMESTAMPTZ   NOT NULL,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ============================================================
-- 3. TOOLS / LISTINGS (FR-2.1, FR-2.2)
-- Prices stored as INTEGER cents per SRS requirement.
-- Location stored as GEOGRAPHY(POINT, 4326) with GiST index.
-- ============================================================
CREATE TABLE IF NOT EXISTS tools (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(150)  NOT NULL,
    description       TEXT,
    category          VARCHAR(50),
    price_per_day     INTEGER       NOT NULL,  -- cents
    security_deposit  INTEGER       NOT NULL,  -- cents
    address           TEXT          NOT NULL,
    location          GEOGRAPHY(POINT, 4326) NOT NULL,
    is_active         BOOLEAN       DEFAULT TRUE,
    created_at        TIMESTAMPTZ   DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_location ON tools USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_tools_owner_id ON tools(owner_id);

-- ============================================================
-- 4. RESERVATIONS (FR-3.1, FR-3.2, FR-3.3)
-- Uses DATERANGE with GiST exclusion constraint to prevent
-- double-booking at the database level.
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id                   UUID               NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    borrower_id               UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date                DATE               NOT NULL,
    end_date                  DATE               NOT NULL,
    booking_range             DATERANGE          NOT NULL,
    status                    reservation_status DEFAULT 'PENDING',
    total_fee_cents           INTEGER            NOT NULL,
    deposit_cents             INTEGER            NOT NULL,
    stripe_payment_intent_id  VARCHAR(255),
    created_at                TIMESTAMPTZ        DEFAULT NOW(),
    updated_at                TIMESTAMPTZ        DEFAULT NOW(),

    -- FR-3.3: Database-level double-booking prevention
    EXCLUDE USING gist (
        tool_id WITH =,
        booking_range WITH &&
    ) WHERE (status NOT IN ('CANCELLED', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_tool_id ON reservations(tool_id);
CREATE INDEX IF NOT EXISTS idx_reservations_borrower_id ON reservations(borrower_id);

-- ============================================================
-- 5. AUDITS (FR-5.1, FR-5.2)
-- ============================================================
CREATE TABLE IF NOT EXISTS audits (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id    UUID                 NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    uploaded_by       UUID                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audit_type        audit_type           NOT NULL,
    image_url         TEXT                 NOT NULL,
    image_category    audit_image_category NOT NULL,
    notes             TEXT,
    created_at        TIMESTAMPTZ          DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_reservation_id ON audits(reservation_id);

-- ============================================================
-- 6. DISPUTES (FR-5.3, FR-5.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS disputes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id    UUID            NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    filed_by          UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason            TEXT            NOT NULL,
    evidence_urls     TEXT[]          DEFAULT '{}',
    status            dispute_status  DEFAULT 'OPEN',
    admin_notes       TEXT,
    resolved_by       UUID            REFERENCES users(id),
    resolved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_reservation_id ON disputes(reservation_id);