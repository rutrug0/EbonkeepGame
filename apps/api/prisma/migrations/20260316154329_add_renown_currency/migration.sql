-- No-op: player_renown_nodes and player_academy_donation_charges were created in
-- 20260316120000_add_renown_persistence and 20260316133005_add_academy_donation_charges
-- respectively and must be preserved. The renown column was already added to
-- "currencies" in 20260316120000_add_renown_persistence.
SELECT 1;
