import {
  equipmentSlotIdSchema,
  inventoryMoveBodySchema,
  inventoryMoveResponseSchema,
  validateVestigeLoadout,
  type EquipmentSlotId,
  type EquippedItem,
  type PlayerClass
} from "@ebonkeep/shared";

import type { FastifyPluginAsync } from "fastify";
import { canItemEquipInSlot, parseStoredInventoryItem } from "./item-service.js";
import { canEquipItemForPlayerClass, createEmptyEquipmentState, ensurePlayerEquipmentSlots, loadPlayerState } from "../player/state-service.js";

const INVENTORY_SLOT_ID = "inventory";

function isEquipmentSlotId(value: string): value is EquipmentSlotId {
  return equipmentSlotIdSchema.safeParse(value).success;
}

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
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
        if (!canEquipItemForPlayerClass(profile.class as PlayerClass, movingItem)) {
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
          if (!canEquipItemForPlayerClass(profile.class as PlayerClass, displacedItem)) {
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
};
