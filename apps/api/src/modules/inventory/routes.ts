import {
  equipmentSlotIdSchema,
  inventoryConsumeBodySchema,
  inventoryConsumeResponseSchema,
  inventoryMoveBodySchema,
  inventoryMoveResponseSchema,
  validateVestigeLoadout,
  type EquipmentSlotId,
  type EquippedItem
} from "@ebonkeep/shared";
import { getConsumableDefinition } from "@ebonkeep/shared/consumables";
import { normalizePlayerClass } from "@ebonkeep/shared/core";

import type { FastifyPluginAsync } from "fastify";
import { canItemEquipInSlot, parseStoredInventoryItem } from "./item-service.js";
import { canEquipItemForPlayerClass, createEmptyEquipmentState, ensurePlayerEquipmentSlots, loadPlayerState } from "../player/state-service.js";
import {
  activateDurationConsumable,
  validateActiveConsumableActivation
} from "../player/active-consumables-service.js";

const INVENTORY_SLOT_ID = "inventory";

function isEquipmentSlotId(value: string): value is EquipmentSlotId {
  return equipmentSlotIdSchema.safeParse(value).success;
}

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/inventory - Get player's inventory items
   */
  fastify.get(
    "/v1/inventory",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const playerId = request.user!.playerId;

      const itemRecords = await fastify.prisma.inventoryItem.findMany({
        where: { playerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          itemCode: true,
          itemData: true
        }
      });

      const items = itemRecords
        .map(record => parseStoredInventoryItem(record))
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return reply.send({ items });
    }
  );

  fastify.post(
    "/v1/inventory/move-item",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const playerId = request.user.playerId;
      const body = inventoryMoveBodySchema.parse(request.body ?? {});

      const fromIsEquipment = isEquipmentSlotId(body.fromSlot);
      const toIsEquipment = isEquipmentSlotId(body.toSlot);
      const fromEquipmentSlotId: EquipmentSlotId | null = fromIsEquipment ? (body.fromSlot as EquipmentSlotId) : null;
      const toEquipmentSlotId: EquipmentSlotId | null = toIsEquipment ? (body.toSlot as EquipmentSlotId) : null;
      const fromIsInventory = body.fromSlot === INVENTORY_SLOT_ID;
      const toIsInventory = body.toSlot === INVENTORY_SLOT_ID;

      if ((!fromIsEquipment && !fromIsInventory) || (!toIsEquipment && !toIsInventory)) {
        return reply.code(400).send({ error: "Unsupported inventory move slot." });
      }

      await ensurePlayerEquipmentSlots(fastify.prisma, playerId);

      const [profile, movingItemRecord] = await Promise.all([
        fastify.prisma.playerProfile.findUnique({
          where: { id: playerId },
          select: {
            class: true,
            level: true,
            equipmentSlots: {
              include: {
                item: true
              }
            }
          }
        }),
        fastify.prisma.inventoryItem.findUnique({
          where: { id: body.itemId },
          select: {
            id: true,
            playerId: true,
            itemCode: true,
            itemData: true
          }
        })
      ]);

      if (!profile || !movingItemRecord || movingItemRecord.playerId !== playerId) {
        return reply.code(404).send({ error: "Inventory item not found." });
      }

      const movingItem = parseStoredInventoryItem(movingItemRecord);

      if (!movingItem) {
        return reply.code(400).send({ error: "Item data is invalid." });
      }

      const currentEquipment = createEmptyEquipmentState();
      const slotRecords = new Map<EquipmentSlotId, (typeof profile.equipmentSlots)[number]>();
      let actualSourceSlot: EquipmentSlotId | "inventory" = INVENTORY_SLOT_ID;

      for (const slot of profile.equipmentSlots) {
        const parsedSlot = equipmentSlotIdSchema.safeParse(slot.slotType);
        if (!parsedSlot.success) {
          continue;
        }

        const slotId = parsedSlot.data;
        slotRecords.set(slotId, slot);
        currentEquipment[slotId] = parseStoredInventoryItem(slot.item);

        if (slot.itemId === movingItem.id) {
          actualSourceSlot = slotId;
        }
      }

      if (body.fromSlot !== actualSourceSlot) {
        return reply.code(400).send({ error: "Source slot does not match item location." });
      }

      if (toEquipmentSlotId) {
        if (!canItemEquipInSlot(movingItem, toEquipmentSlotId)) {
          return reply.code(400).send({ error: "Item cannot be equipped in that slot." });
        }
        if (!canEquipItemForPlayerClass(normalizePlayerClass(profile.class), movingItem)) {
          return reply.code(400).send({ error: "Item cannot be used by this class." });
        }
        if (movingItem.levelRequirement > profile.level) {
          return reply.code(400).send({ error: "Player level is too low for this item." });
        }
      }

      const nextEquipment = createEmptyEquipmentState();
      for (const [slotId, item] of Object.entries(currentEquipment)) {
        nextEquipment[slotId as EquipmentSlotId] = item;
      }

      if (fromEquipmentSlotId) {
        nextEquipment[fromEquipmentSlotId] = null;
      }

      const displacedItem = toEquipmentSlotId ? nextEquipment[toEquipmentSlotId] : null;

      if (toEquipmentSlotId) {
        if (fromEquipmentSlotId && fromEquipmentSlotId !== toEquipmentSlotId && displacedItem) {
          if (!canItemEquipInSlot(displacedItem, fromEquipmentSlotId)) {
            return reply.code(400).send({ error: "Items cannot be swapped between those slots." });
          }
          if (!canEquipItemForPlayerClass(normalizePlayerClass(profile.class), displacedItem)) {
            return reply.code(400).send({ error: "Swapped item cannot be used by this class." });
          }
          if (displacedItem.levelRequirement > profile.level) {
            return reply.code(400).send({ error: "Swapped item exceeds player level." });
          }
          nextEquipment[fromEquipmentSlotId] = displacedItem;
        }

        nextEquipment[toEquipmentSlotId] = movingItem;
      }

      const equippedVestigeIds = Object.values(nextEquipment)
        .map((item) => item?.archetype.vestigeId)
        .filter((vestigeId): vestigeId is NonNullable<EquippedItem["archetype"]["vestigeId"]> => vestigeId !== undefined);
      const vestigeValidation = validateVestigeLoadout(equippedVestigeIds);
      if (!vestigeValidation.valid) {
        return reply.code(400).send({
          error:
            vestigeValidation.reason === "duplicate_vestige"
              ? "Duplicate vestige cannot be equipped."
              : "Too many vestiges equipped."
        });
      }

      if (body.fromSlot === body.toSlot) {
        const playerState = await loadPlayerState(fastify.prisma, playerId);
        if (!playerState) {
          return reply.code(404).send({ error: "Player state not found." });
        }

        return reply.send(
          inventoryMoveResponseSchema.parse({
            moved: true,
            itemId: body.itemId,
            playerState
          })
        );
      }

      await fastify.prisma.$transaction(async (prisma) => {
        if (fromEquipmentSlotId) {
          const sourceSlot = slotRecords.get(fromEquipmentSlotId);
          if (!sourceSlot) {
            throw new Error("Missing source equipment slot.");
          }

          await prisma.equipmentSlot.update({
            where: { id: sourceSlot.id },
            data: {
              itemId: toEquipmentSlotId && displacedItem ? displacedItem.id : null
            }
          });
        }

        if (toEquipmentSlotId) {
          const targetSlot = slotRecords.get(toEquipmentSlotId);
          if (!targetSlot) {
            throw new Error("Missing target equipment slot.");
          }

          await prisma.equipmentSlot.update({
            where: { id: targetSlot.id },
            data: {
              itemId: movingItem.id
            }
          });
        }

        await prisma.inventoryItem.update({
          where: { id: movingItem.id },
          data: {
            slotKey: toEquipmentSlotId ?? INVENTORY_SLOT_ID
          }
        });

        if (displacedItem) {
          await prisma.inventoryItem.update({
            where: { id: displacedItem.id },
            data: {
              slotKey:
                fromEquipmentSlotId && fromEquipmentSlotId !== toEquipmentSlotId
                  ? fromEquipmentSlotId
                  : INVENTORY_SLOT_ID
            }
          });
        }
      });

      const playerState = await loadPlayerState(fastify.prisma, playerId);

      if (!playerState) {
        return reply.code(404).send({ error: "Player state not found." });
      }

      const payload = inventoryMoveResponseSchema.parse({
        moved: true,
        itemId: body.itemId,
        playerState
      });

      return reply.send(payload);
    }
  );

  fastify.post(
    "/v1/inventory/consume-item",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const playerId = request.user.playerId;
      const body = inventoryConsumeBodySchema.parse(request.body ?? {});
      const now = new Date();
      let consumedItemPayload: {
        itemId: string;
        itemCode: string;
        itemName: string;
        consumedQuantity: number;
        remainingQuantity: number;
        consumableType: "potion" | "tonic" | "elixir";
        instantResolved: boolean;
        activated: boolean;
      } | null = null;

      try {
        await fastify.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "player_profiles" WHERE "id" = ${playerId} FOR UPDATE`;

          const itemRecord = await tx.inventoryItem.findUnique({
            where: { id: body.itemId },
            select: {
              id: true,
              playerId: true,
              itemCode: true,
              itemData: true,
              quantity: true
            }
          });

          if (!itemRecord || itemRecord.playerId !== playerId) {
            throw new Error("CONSUME_NOT_FOUND");
          }

          const parsedItem = parseStoredInventoryItem(itemRecord);
          if (!parsedItem) {
            throw new Error("CONSUME_INVALID_ITEM");
          }

          const consumableDefinition = getConsumableDefinition(itemRecord.itemCode);
          if (!consumableDefinition) {
            throw new Error("CONSUME_NOT_CONSUMABLE");
          }

          const quantity = Math.max(0, itemRecord.quantity);
          if (quantity <= 0) {
            throw new Error("CONSUME_NOT_FOUND");
          }

          const instantResolved = consumableDefinition.type === "potion" || consumableDefinition.durationKind === "instant";
          if (!instantResolved) {
            const activationValidation = await validateActiveConsumableActivation(
              tx,
              playerId,
              consumableDefinition,
              now
            );
            if (!activationValidation.valid) {
              throw new Error(
                activationValidation.reason === "cap_reached"
                  ? "CONSUME_STACK_CAP_REACHED"
                  : "CONSUME_FAMILY_CONFLICT"
              );
            }
          }

          if (instantResolved) {
            const playerState = await loadPlayerState(tx, playerId);
            if (!playerState) {
              throw new Error("CONSUME_PLAYER_NOT_FOUND");
            }

            let restoreHealth = 0;
            let restoreStamina = 0;
            for (const effect of consumableDefinition.effects) {
              if (effect.type === "restore_health_pct_max") {
                restoreHealth += Math.round((playerState.health.max * effect.value) / 100);
              }
              if (effect.type === "restore_stamina_pct_max") {
                restoreStamina += Math.round((playerState.stamina.max * effect.value) / 100);
              }
            }

            const nextHealth = Math.min(
              playerState.health.max,
              playerState.health.current + Math.max(0, restoreHealth)
            );
            const nextStamina = Math.min(
              playerState.stamina.max,
              playerState.stamina.current + Math.max(0, restoreStamina)
            );

            await tx.playerProfile.update({
              where: { id: playerId },
              data: {
                hitpointsCurrent: nextHealth,
                hitpointsUpdatedAt: now,
                staminaCurrent: nextStamina,
                staminaUpdatedAt: now
              }
            });
          } else {
            await activateDurationConsumable({
              prisma: tx,
              playerId,
              definition: consumableDefinition,
              now
            });
          }

          const remainingQuantity = quantity - 1;
          if (remainingQuantity <= 0) {
            await tx.inventoryItem.delete({
              where: { id: itemRecord.id }
            });
          } else {
            await tx.inventoryItem.update({
              where: { id: itemRecord.id },
              data: { quantity: remainingQuantity }
            });
          }

          consumedItemPayload = {
            itemId: itemRecord.id,
            itemCode: itemRecord.itemCode,
            itemName: parsedItem.itemName,
            consumedQuantity: 1,
            remainingQuantity: Math.max(0, remainingQuantity),
            consumableType: consumableDefinition.type,
            instantResolved,
            activated: !instantResolved
          };
        });

        const playerState = await loadPlayerState(fastify.prisma, playerId);
        if (!playerState || !consumedItemPayload) {
          return reply.code(404).send({ error: "Player state not found." });
        }

        return reply.send(
          inventoryConsumeResponseSchema.parse({
            playerState,
            consumedItem: consumedItemPayload
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "CONSUME_FAILED";
        if (message === "CONSUME_NOT_FOUND") {
          return reply.code(404).send({ error: "Inventory item not found." });
        }
        if (message === "CONSUME_PLAYER_NOT_FOUND") {
          return reply.code(404).send({ error: "Player state not found." });
        }
        if (message === "CONSUME_INVALID_ITEM") {
          return reply.code(400).send({ error: "Item data is invalid." });
        }
        if (message === "CONSUME_NOT_CONSUMABLE") {
          return reply.code(400).send({ error: "Item is not a consumable." });
        }
        if (message === "CONSUME_STACK_CAP_REACHED") {
          return reply.code(409).send({ error: "Consumable stack cap reached." });
        }
        if (message === "CONSUME_FAMILY_CONFLICT") {
          return reply.code(409).send({ error: "A consumable from this family is already active." });
        }

        fastify.log.error({ err: error }, "Failed to consume inventory item");
        return reply.code(500).send({ error: "Failed to consume inventory item." });
      }
    }
  );
};
