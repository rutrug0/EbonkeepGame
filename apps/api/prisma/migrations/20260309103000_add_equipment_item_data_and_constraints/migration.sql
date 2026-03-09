ALTER TABLE "inventory_items"
ADD COLUMN "itemData" JSONB;

INSERT INTO "equipment_slots" ("id", "playerId", "slotType", "itemId", "createdAt", "updatedAt")
SELECT
  'equip_' || md5(p."id" || ':' || s."slotType"),
  p."id",
  s."slotType",
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "player_profiles" p
CROSS JOIN (
  VALUES
    ('helmet'),
    ('necklace'),
    ('upperArmor'),
    ('belt'),
    ('ringLeft'),
    ('weapon'),
    ('pauldrons'),
    ('gloves'),
    ('lowerArmor'),
    ('boots'),
    ('ringRight'),
    ('vestige1'),
    ('vestige2'),
    ('vestige3')
) AS s("slotType")
WHERE NOT EXISTS (
  SELECT 1
  FROM "equipment_slots" existing
  WHERE existing."playerId" = p."id"
    AND existing."slotType" = s."slotType"
);

CREATE UNIQUE INDEX "equipment_slots_itemId_key" ON "equipment_slots"("itemId");

CREATE UNIQUE INDEX "equipment_slots_playerId_slotType_key" ON "equipment_slots"("playerId", "slotType");

ALTER TABLE "equipment_slots"
ADD CONSTRAINT "equipment_slots_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
