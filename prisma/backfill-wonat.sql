-- Idempotent backfill: give already-WON prospects a wonAt so the new
-- revenue-by-wonAt reporting doesn't silently drop historical deals.
-- Runs at container startup after `prisma db push`; the WHERE clause makes
-- repeat runs a no-op.
UPDATE "Prospect" SET "wonAt" = "updatedAt" WHERE "status" = 'WON' AND "wonAt" IS NULL;
