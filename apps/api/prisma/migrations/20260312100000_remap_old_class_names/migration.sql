-- Remap legacy class names to the new 9-class system.
-- warrior  → juggernaut (STR archetype default)
-- ranger   → shade      (DEX archetype default)
-- mage     → arcanist   (INT archetype default)

UPDATE "player_profiles" SET "class" = 'juggernaut' WHERE "class" = 'warrior';
UPDATE "player_profiles" SET "class" = 'shade'      WHERE "class" = 'ranger';
UPDATE "player_profiles" SET "class" = 'arcanist'   WHERE "class" = 'mage';
