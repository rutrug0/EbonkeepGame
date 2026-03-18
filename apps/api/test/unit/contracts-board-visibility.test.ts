import { describe, expect, it } from "vitest";

import { shouldIncludeContractBoardSlot } from "../../src/modules/contracts/service.js";

describe("contract board visibility", () => {
  it("keeps academy bonus slots visible while they still have an active run", () => {
    expect(
      shouldIncludeContractBoardSlot({
        slotIndex: 7,
        slotCount: 6,
        activeRunId: "run_7"
      })
    ).toBe(true);
  });

  it("hides inactive bonus slots once the current academy slot cap drops", () => {
    expect(
      shouldIncludeContractBoardSlot({
        slotIndex: 7,
        slotCount: 6,
        activeRunId: null
      })
    ).toBe(false);
  });
});
