-- Pilot schema: verified listings, availability blocks and guest leads.
-- No payments in the pilot: every booking happens directly between guest and host.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE properties (
    id                UUID PRIMARY KEY,
    slug              VARCHAR(140) NOT NULL UNIQUE,
    name              VARCHAR(150) NOT NULL,
    area              VARCHAR(80)  NOT NULL,
    address           TEXT         NOT NULL,
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    description       TEXT         NOT NULL DEFAULT '',
    house_rules       TEXT         NOT NULL DEFAULT '',
    max_guests        INT          NOT NULL CHECK (max_guests > 0),
    bedrooms          INT          NOT NULL DEFAULT 0 CHECK (bedrooms >= 0),
    has_pool          BOOLEAN      NOT NULL DEFAULT FALSE,
    amenities         TEXT[]       NOT NULL DEFAULT '{}',
    photo_urls        TEXT[]       NOT NULL DEFAULT '{}',
    -- Prices in whole rupees, per day (day-use) or per night (overnight).
    day_use_price_min INT CHECK (day_use_price_min > 0),
    day_use_price_max INT,
    night_price_min   INT CHECK (night_price_min > 0),
    night_price_max   INT,
    host_name         VARCHAR(120) NOT NULL,
    -- Normalised Indian mobile number, digits only with country code, e.g. 919812345678.
    -- Never returned by the public API.
    host_phone        VARCHAR(15)  NOT NULL,
    -- Secret that opens the host's page. Shared with the host only.
    host_token        VARCHAR(64)  NOT NULL UNIQUE,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'LIVE', 'PAUSED')),
    verified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT price_shown CHECK (day_use_price_min IS NOT NULL OR night_price_min IS NOT NULL),
    CONSTRAINT day_use_range CHECK (day_use_price_max IS NULL OR day_use_price_max >= day_use_price_min),
    CONSTRAINT night_range CHECK (night_price_max IS NULL OR night_price_max >= night_price_min)
);

CREATE INDEX properties_status_area_idx ON properties (status, area);

CREATE TABLE leads (
    id          UUID PRIMARY KEY,
    property_id UUID         NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    -- Short code put in the WhatsApp message so the host can tell us which lead became a booking.
    reference   VARCHAR(12)  NOT NULL UNIQUE,
    guest_name  VARCHAR(100) NOT NULL,
    event_date  DATE         NOT NULL,
    nights      INT          NOT NULL DEFAULT 1 CHECK (nights BETWEEN 1 AND 30),
    guests      INT          NOT NULL CHECK (guests > 0),
    slot_type   VARCHAR(20)  NOT NULL CHECK (slot_type IN ('DAY_USE', 'NIGHT', 'EVENT')),
    channel     VARCHAR(20)  NOT NULL CHECK (channel IN ('WHATSAPP', 'CALL')),
    status      VARCHAR(20)  NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'BOOKED', 'NOT_BOOKED')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX leads_property_created_idx ON leads (property_id, created_at DESC);

-- Dates a farmhouse is not available. One calendar day is the unit for both
-- day-use and overnight: a night of 31 Dec blocks [31 Dec, 1 Jan).
CREATE TABLE availability_blocks (
    id          UUID PRIMARY KEY,
    property_id UUID        NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    start_date  DATE        NOT NULL,
    end_date    DATE        NOT NULL, -- exclusive
    source      VARCHAR(30) NOT NULL CHECK (source IN ('HOST_BLOCKED', 'DIRECT_CONFIRMED')),
    lead_id     UUID REFERENCES leads (id) ON DELETE SET NULL,
    note        VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date > start_date),
    -- The database itself refuses two overlapping blocks for one farmhouse.
    CONSTRAINT no_overlapping_blocks EXCLUDE USING gist (
        property_id WITH =,
        daterange(start_date, end_date, '[)') WITH &&
    )
);
