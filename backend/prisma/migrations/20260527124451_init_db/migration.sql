-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('checked_in', 'active', 'watchdog_alert', 'emergency', 'completed', 'cancelled', 'resolved');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20),
    "emergency_contact_name" VARCHAR(150),
    "emergency_contact_phone" VARCHAR(20),
    "medical_profile" JSONB,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'it',
    "avatar_url" TEXT,
    "fitness_level" VARCHAR(20) NOT NULL DEFAULT 'intermediate',
    "privacy_consent" BOOLEAN NOT NULL DEFAULT false,
    "privacy_consent_date" TIMESTAMPTZ,
    "data_retention_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trails" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "geofence_buffer" INTEGER NOT NULL DEFAULT 200,
    "distance_meters" DOUBLE PRECISION NOT NULL,
    "elevation_gain" DOUBLE PRECISION,
    "elevation_loss" DOUBLE PRECISION,
    "elevation_min" DOUBLE PRECISION,
    "elevation_max" DOUBLE PRECISION,
    "difficulty" VARCHAR(5) NOT NULL,
    "avg_duration_minutes" INTEGER NOT NULL,
    "min_duration_minutes" INTEGER,
    "max_duration_minutes" INTEGER,
    "watchdog_tolerance_pct" INTEGER NOT NULL DEFAULT 40,
    "surface_type" VARCHAR(50),
    "is_loop" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "seasonal_closure" VARCHAR(100),
    "gpx_file_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    
    -- Custom PostGIS columns
    "route_geom" GEOMETRY(LINESTRING, 4326),
    "start_point" GEOMETRY(POINT, 4326),
    "end_point" GEOMETRY(POINT, 4326),

    CONSTRAINT "trails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_pois" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "trail_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "photo_url" TEXT,
    "is_danger" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Custom PostGIS column
    "location" GEOMETRY(POINT, 4326),

    CONSTRAINT "trail_pois_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiking_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "trail_id" UUID NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'checked_in',
    "check_in_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "expected_end_at" TIMESTAMPTZ,
    "watchdog_triggered_at" TIMESTAMPTZ,
    "user_responded_at" TIMESTAMPTZ,
    "emergency_triggered_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "group_id" UUID,
    "is_group_leader" BOOLEAN NOT NULL DEFAULT false,
    "last_location_at" TIMESTAMPTZ,
    "last_battery_level" INTEGER,
    "is_offline" BOOLEAN NOT NULL DEFAULT false,
    "offline_since" TIMESTAMPTZ,
    "actual_duration_minutes" INTEGER,
    "actual_distance_meters" DOUBLE PRECISION,
    "avg_speed_kmh" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    
    -- Custom PostGIS column
    "last_known_location" GEOMETRY(POINT, 4326),

    CONSTRAINT "hiking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "altitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "battery_level" INTEGER,
    "is_offline" BOOLEAN NOT NULL DEFAULT false,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Custom PostGIS column
    "location" GEOMETRY(POINT, 4326),

    CONSTRAINT "location_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "sms_sent_to" TEXT[],
    "call_initiated" BOOLEAN NOT NULL DEFAULT false,
    "call_number" VARCHAR(20),
    "user_snapshot" JSONB,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by" UUID,
    "resolution_notes" TEXT,
    "false_alarm" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Custom PostGIS column
    "gps_coordinates" GEOMETRY(POINT, 4326),

    CONSTRAINT "emergency_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "icon_url" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "criteria" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rarity" VARCHAR(20) NOT NULL DEFAULT 'common',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "session_id" UUID,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_stamps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "trail_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "stamp_image_url" TEXT,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trail_stamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'operator',
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchdog_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchdog_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "trails_code_key" ON "trails"("code");

-- CreateIndex
CREATE INDEX "trail_pois_trail_id_idx" ON "trail_pois"("trail_id");

-- CreateIndex
CREATE INDEX "hiking_sessions_user_id_idx" ON "hiking_sessions"("user_id");

-- CreateIndex
CREATE INDEX "hiking_sessions_trail_id_idx" ON "hiking_sessions"("trail_id");

-- CreateIndex
CREATE INDEX "hiking_sessions_status_idx" ON "hiking_sessions"("status");

-- CreateIndex
CREATE INDEX "hiking_sessions_group_id_idx" ON "hiking_sessions"("group_id");

-- CreateIndex
CREATE INDEX "location_logs_session_id_idx" ON "location_logs"("session_id");

-- CreateIndex
CREATE INDEX "location_logs_session_id_recorded_at_idx" ON "location_logs"("session_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "emergency_events_session_id_idx" ON "emergency_events"("session_id");

-- CreateIndex
CREATE INDEX "emergency_events_user_id_idx" ON "emergency_events"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "trail_stamps_user_id_idx" ON "trail_stamps"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trail_stamps_user_id_trail_id_key" ON "trail_stamps"("user_id", "trail_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- Custom GIST Spatial Indices
CREATE INDEX "trails_route_geom_idx" ON "trails" USING GIST ("route_geom");
CREATE INDEX "trails_start_point_idx" ON "trails" USING GIST ("start_point");
CREATE INDEX "trails_end_point_idx" ON "trails" USING GIST ("end_point");
CREATE INDEX "trail_pois_location_idx" ON "trail_pois" USING GIST ("location");
CREATE INDEX "hiking_sessions_last_known_location_idx" ON "hiking_sessions" USING GIST ("last_known_location");
CREATE INDEX "location_logs_location_idx" ON "location_logs" USING GIST ("location");
CREATE INDEX "emergency_events_gps_coordinates_idx" ON "emergency_events" USING GIST ("gps_coordinates");

-- AddForeignKey
ALTER TABLE "trail_pois" ADD CONSTRAINT "trail_pois_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "trails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiking_sessions" ADD CONSTRAINT "hiking_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiking_sessions" ADD CONSTRAINT "hiking_sessions_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_logs" ADD CONSTRAINT "location_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "hiking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "hiking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_stamps" ADD CONSTRAINT "trail_stamps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_stamps" ADD CONSTRAINT "trail_stamps_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_stamps" ADD CONSTRAINT "trail_stamps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "hiking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
