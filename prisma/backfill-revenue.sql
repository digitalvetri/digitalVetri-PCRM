-- Seed the revenue ledger from history: one PROJECT entry per already-WON
-- prospect that has a value and no entry yet. Marked PAID (historical closed
-- deals are assumed collected). Idempotent — the NOT EXISTS guard makes repeat
-- runs a no-op. Runs at container startup after `prisma db push`.
INSERT INTO "RevenueEntry" (id, "companyId", "prospectId", date, kind, amount, cost, status, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p."companyId",
  p.id,
  COALESCE(p."wonAt", p."updatedAt"),
  'PROJECT',
  COALESCE(p."proposalValue", 0),
  0,
  'PAID',
  now(),
  now()
FROM "Prospect" p
WHERE p.status = 'WON'
  AND COALESCE(p."proposalValue", 0) > 0
  AND NOT EXISTS (SELECT 1 FROM "RevenueEntry" r WHERE r."prospectId" = p.id);
