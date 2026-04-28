-- Q2 roadmap: product analytics events + daily rollups + ops incidents (no PSP).

CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "properties" JSONB,
    "clientTs" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");
CREATE INDEX IF NOT EXISTS "analytics_events_name_createdAt_idx" ON "analytics_events"("name", "createdAt");

CREATE TABLE IF NOT EXISTS "analytics_daily_rollups" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_rollups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_rollups_day_name_key" ON "analytics_daily_rollups"("day", "name");

CREATE TABLE IF NOT EXISTS "ops_incidents" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ops_incidents_createdAt_idx" ON "ops_incidents"("createdAt");
CREATE INDEX IF NOT EXISTS "ops_incidents_kind_idx" ON "ops_incidents"("kind");
