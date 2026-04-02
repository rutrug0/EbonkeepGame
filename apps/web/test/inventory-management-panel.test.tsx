import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlayerState } from "@ebonkeep/shared/player";

import { InventoryManagementPanel, type InventoryManagementPanelProps } from "../src/features/profile/InventoryManagementPanel";

function createPlayerStateFixture(): PlayerState {
  return {
    class: "juggernaut",
    stats: {
      strength: 10,
      intelligence: 10,
      dexterity: 10,
      vitality: 10,
      initiative: 10,
      luck: 10
    },
    statSnapshot: {
      guild: {
        strength: 0,
        intelligence: 0,
        dexterity: 0,
        vitality: 0,
        initiative: 0,
        luck: 0
      }
    },
    currency: {
      ducats: 500,
      imperials: 3
    }
  } as unknown as PlayerState;
}

function createProps(overrides?: Partial<InventoryManagementPanelProps>): InventoryManagementPanelProps {
  return {
    embedded: true,
    isLoadingState: false,
    playerState: createPlayerStateFixture(),
    baseStats: null,
    currencies: null,
    minimumPreviewDucats: 0,
    equipmentStatBonuses: {
      strength: 0,
      intelligence: 0,
      dexterity: 0,
      vitality: 0,
      initiative: 0,
      luck: 0
    },
    inventorySlotCapacity: 20,
    inventoryStatFlashes: {},
    activeStatTraining: null,
    nowMs: Date.now(),
    statTrainDurationMs: 60_000,
    profileName: "Test Hero",
    activeCharacterVisualPath: null,
    activeCharacterVisualName: null,
    activeConsumables: [],
    portraitDropState: null,
    isPortraitConsumePulseActive: false,
    canCycleCharacterVisuals: false,
    equipmentLeftSlots: [],
    equipmentRightSlots: [],
    equipmentVestigeSlots: [],
    renderCharacterHubTabs: () => <div />,
    renderEquipmentSlotCell: (slotId) => <div key={slotId} data-testid={`slot-${slotId}`} />,
    onShowPreviousPortrait: () => {},
    onShowNextPortrait: () => {},
    activeBackgroundPath: null,
    onShowPreviousBackground: () => {},
    onShowNextBackground: () => {},
    onPortraitDragOver: () => {},
    onPortraitDragLeave: () => {},
    onPortraitDrop: () => {},
    onStartStatTraining: () => {},
    getTrainingCost: () => 100,
    getStatContributionLines: () => [],
    formatDurationFromMs: (value) => `${Math.max(0, Math.floor(value / 1000))}s`,
    ...overrides
  };
}

describe("inventory management panel", () => {
  it("renders active consumables strip entries with effect tooltip content", () => {
    render(
      <InventoryManagementPanel
        {...createProps({
          activeConsumables: [
            {
              id: "active_1",
              itemCode: "consumable_wardens_tonic",
              itemName: "Warden's Tonic",
              rarity: "rare",
              effectLines: ["Armor +10", "Magic Defense +2.5%"],
              durationLabel: "2 encounters remaining"
            }
          ]
        })}
      />
    );

    expect(screen.getByLabelText("Active consumables")).toBeTruthy();
    expect(screen.getByLabelText("Warden's Tonic: 2 encounters remaining")).toBeTruthy();
    expect(screen.getByText("Armor +10")).toBeTruthy();
    expect(screen.getByText("Magic Defense +2.5%")).toBeTruthy();
  });

  it("shows portrait drop cue states and empty active-effects placeholder", () => {
    const { rerender } = render(
      <InventoryManagementPanel
        {...createProps({
          portraitDropState: "valid"
        })}
      />
    );

    expect(screen.getByTestId("character-portrait-drop-target").className).toContain("portraitDropValid");
    expect(screen.getByText("No active effects")).toBeTruthy();

    rerender(
      <InventoryManagementPanel
        {...createProps({
          portraitDropState: "invalid"
        })}
      />
    );

    expect(screen.getByTestId("character-portrait-drop-target").className).toContain("portraitDropInvalid");
  });
});
