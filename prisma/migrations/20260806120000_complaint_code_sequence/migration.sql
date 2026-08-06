-- Human-readable complaint codes (CC-2026-01042) are drawn from a sequence, so two
-- citizens submitting at the same instant can never collide on the unique `code`.
-- Starts at 1000 to leave the low numbers to seeded sample rows.
CREATE SEQUENCE IF NOT EXISTS "complaint_code_seq" START 1000;
