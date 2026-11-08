-- Food Delivery schema (PostgreSQL). Prices are stored in KRW as integers (won has no minor unit).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'manager', 'admin', 'courier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_type AS ENUM ('delivery', 'pickup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Uploaded images are stored in the DB so they survive redeploys on hosts with ephemeral disks.
CREATE TABLE IF NOT EXISTS images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type   VARCHAR(50) NOT NULL,
  size_bytes  INTEGER     NOT NULL,
  data        BYTEA       NOT NULL,
  uploaded_by UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(50)  NOT NULL,
  email              VARCHAR(255) NOT NULL UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  role               user_role    NOT NULL DEFAULT 'customer',
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  preferred_language VARCHAR(5)   NOT NULL DEFAULT 'en',
  passport           JSONB,          -- food passport: {"enabled":true,"diet":[],"allergens":[],"maxSpice":3}; NULL = not set up
  phone              VARCHAR(30),
  postal_code        VARCHAR(10),
  address_line1      VARCHAR(255),   -- road address (from postcode search)
  address_line2      VARCHAR(255),   -- detail: building, apt, unit
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Saved cards. We never store card numbers: only the payment provider's billing key and display data.
CREATE TABLE IF NOT EXISTS payment_methods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     VARCHAR(20)  NOT NULL,             -- 'mock' | 'toss'
  billing_key  VARCHAR(255) NOT NULL,
  card_brand   VARCHAR(30),                       -- VISA, MASTERCARD, 신한, 국민 ...
  last4        VARCHAR(4),
  is_foreign   BOOLEAN NOT NULL DEFAULT FALSE,    -- issued outside Korea
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

CREATE TABLE IF NOT EXISTS restaurants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(100) NOT NULL,
  description        TEXT,
  cuisine_type       VARCHAR(50)  NOT NULL,
  address            VARCHAR(255),
  phone              VARCHAR(30),
  image_url          VARCHAR(500),
  is_active          BOOLEAN  NOT NULL DEFAULT TRUE,
  supports_delivery  BOOLEAN  NOT NULL DEFAULT TRUE,
  supports_pickup    BOOLEAN  NOT NULL DEFAULT TRUE,
  delivery_fee       INTEGER  NOT NULL DEFAULT 3000 CHECK (delivery_fee >= 0),
  min_order_amount   INTEGER  NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  prep_time_minutes  INTEGER  NOT NULL DEFAULT 30 CHECK (prep_time_minutes > 0),
  average_rating     NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count       INTEGER  NOT NULL DEFAULT 0,
  mood_tags          TEXT[]   NOT NULL DEFAULT '{}',          -- spicy, light, comfort, sweet, late_night
  source_language    VARCHAR(5) NOT NULL DEFAULT 'ko',
  translations       JSONB    NOT NULL DEFAULT '{}'::jsonb,  -- {"en": {"description": "..."}}
  translation_status VARCHAR(10) NOT NULL DEFAULT 'none',    -- none | pending | done
  manager_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_restaurants_manager ON restaurants(manager_id);

CREATE TABLE IF NOT EXISTS menu_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_side         BOOLEAN NOT NULL DEFAULT FALSE,           -- sides / drinks: not counted when recommending restaurants
  source_language VARCHAR(5) NOT NULL DEFAULT 'ko',
  translations    JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {"en": {"name": "..."}}
  translation_status VARCHAR(10) NOT NULL DEFAULT 'none',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON menu_categories(restaurant_id);

CREATE TABLE IF NOT EXISTS menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name            VARCHAR(100)  NOT NULL,
  description     VARCHAR(1000),
  price           INTEGER NOT NULL CHECK (price > 0),        -- KRW
  image_url       VARCHAR(500),
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  allergens       TEXT[]  NOT NULL DEFAULT '{}',             -- e.g. {egg,milk,wheat}
  dietary_tags    TEXT[]  NOT NULL DEFAULT '{}',             -- e.g. {halal,vegetarian}
  spice_level     SMALLINT NOT NULL DEFAULT 0 CHECK (spice_level BETWEEN 0 AND 3),
  romanization    VARCHAR(150),                              -- e.g. "kimchi-jjigae" (how to say the Korean name)
  review_status   VARCHAR(16) NOT NULL DEFAULT 'new',        -- admin check after publication: new | ok | needs_changes | removed
  admin_note      VARCHAR(1000),                             -- what the admin asked the owner to fix
  flagged_at      TIMESTAMPTZ,                               -- when changes were requested (auto-hide after DISH_FIX_DAYS)
  explanation     VARCHAR(1000),                             -- "What is it?" for foreigners (source language)
  source_language VARCHAR(5) NOT NULL DEFAULT 'ko',
  translations    JSONB NOT NULL DEFAULT '{}'::jsonb,        -- {"en": {"name","description","explanation","manual"?}}
  translation_status VARCHAR(10) NOT NULL DEFAULT 'none',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_allergens ON menu_items USING GIN (allergens);
CREATE INDEX IF NOT EXISTS idx_items_dietary ON menu_items USING GIN (dietary_tags);

CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number      SERIAL UNIQUE,
  customer_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  order_type        order_type    NOT NULL DEFAULT 'delivery',
  status            order_status  NOT NULL DEFAULT 'pending',
  delivery_address  VARCHAR(255),          -- required for delivery, NULL for pickup
  contact_phone     VARCHAR(30)   NOT NULL,
  customer_note     VARCHAR(500),
  items_amount      INTEGER NOT NULL CHECK (items_amount >= 0),
  delivery_fee      INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total_amount      INTEGER NOT NULL CHECK (total_amount >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'KRW',
  payment_status    payment_status NOT NULL DEFAULT 'pending',
  courier_id        UUID REFERENCES users(id) ON DELETE SET NULL,   -- courier who took the delivery
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  payment_provider  VARCHAR(20),
  payment_reference VARCHAR(255),          -- provider payment id (for refunds)
  card_label        VARCHAR(60),           -- e.g. "VISA •••• 4242" snapshot
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_needs_address CHECK (order_type = 'pickup' OR delivery_address IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id       UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name_snapshot VARCHAR(100) NOT NULL,
  price_snapshot     INTEGER      NOT NULL,
  quantity           INTEGER      NOT NULL CHECK (quantity > 0),
  subtotal           INTEGER      NOT NULL CHECK (subtotal >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       VARCHAR(1000),
  is_approved   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id);

-- Upgrades for databases created with an earlier version of this schema (safe to re-run).
ALTER TABLE users       ADD COLUMN IF NOT EXISTS passport JSONB;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS mood_tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS translation_status VARCHAR(10) NOT NULL DEFAULT 'none';
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS is_side BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS translation_status VARCHAR(10) NOT NULL DEFAULT 'none';
ALTER TABLE menu_items  ADD COLUMN IF NOT EXISTS romanization VARCHAR(150);
ALTER TABLE menu_items  ADD COLUMN IF NOT EXISTS explanation VARCHAR(1000);
ALTER TABLE menu_items  ADD COLUMN IF NOT EXISTS translation_status VARCHAR(10) NOT NULL DEFAULT 'none';
ALTER TABLE users ALTER COLUMN preferred_language SET DEFAULT 'en';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'courier';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS review_status VARCHAR(16) NOT NULL DEFAULT 'new';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS admin_note VARCHAR(1000);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_items_review ON menu_items(review_status);
-- Orders paid together in one checkout (cart with several restaurants)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_id UUID;
CREATE INDEX IF NOT EXISTS idx_orders_checkout ON orders(checkout_id);
-- Opening hours (Asia/Seoul). NULL = open around the clock. closes_at < opens_at means "past midnight".
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opens_at TIME;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closes_at TIME;
-- When the customer agreed to store their food passport (diet / allergies are health-related data)
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_consent_at TIMESTAMPTZ;
-- Reviews are translated once into every language (source language detected from the text)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source_language VARCHAR(5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS translation_status VARCHAR(10) NOT NULL DEFAULT 'none';
-- Photos attached to a review (up to 3, stored in the images table)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';
