import { useEffect } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let gardenFirstPaintReady = false;
let gardenResponseDelayMs = 0;
let jobsFirstPaintReady = false;
let jobsResponseDelayMs = 0;
let refineryFirstPaintReady = false;
let refineryResponseDelayMs = 0;
let leaderboardFirstPaintReady = true;
let missionsFirstPaintReady = false;
let missionsResponseDelayMs = 0;
let arenaFirstPaintReady = false;
let arenaResponseDelayMs = 0;
let auctionHouseFirstPaintReady = false;
let auctionHouseResponseDelayMs = 0;

vi.mock("../src/features/auth", () => ({
  forgotPassword: vi.fn(() => new Promise(() => {})),
  getAccountOverview: vi.fn(() => new Promise(() => {})),
  checkAvailability: vi.fn(() => new Promise(() => {})),
  login: vi.fn(() => new Promise(() => {})),
  register: vi.fn(() => new Promise(() => {})),
  resendVerificationEmail: vi.fn(() => new Promise(() => {})),
  resetPassword: vi.fn(() => new Promise(() => {})),
  verifyEmail: vi.fn(() => new Promise(() => {}))
}));

vi.mock("../src/features/player", () => ({
  devGuestLogin: vi.fn(() => new Promise(() => {})),
  fetchPlayerState: vi.fn(() => new Promise(() => {})),
  generateEquipmentCheats: vi.fn(() => new Promise(() => {})),
  grantCurrencyCheats: vi.fn(() => new Promise(() => {})),
  levelUpPlayerCheats: vi.fn(() => new Promise(() => {})),
  moveInventoryItem: vi.fn(() => new Promise(() => {})),
  replenishPlayerCheats: vi.fn(() => new Promise(() => {})),
  restPlayer: vi.fn(() => new Promise(() => {})),
  updatePlayerCheatSettings: vi.fn(() => new Promise(() => {})),
  updatePlayerPreferences: vi.fn(() => new Promise(() => {})),
  updatePortrait: vi.fn(() => new Promise(() => {}))
}));

vi.mock("../src/features/garden", () => ({
  GardenPanel: (props: { onFirstPaintReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      const timeoutId = window.setTimeout(() => {
        props.onFirstPaintReadyChange?.(gardenFirstPaintReady);
      }, gardenResponseDelayMs);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, []);

    return <div data-testid="garden-panel">Garden panel loading shell</div>;
  },
  fetchGardenState: vi.fn(() => new Promise(() => {})),
  updateGardenUnlockedSlots: vi.fn(() => new Promise(() => {}))
}));

vi.mock("../src/features/jobs", () => ({
  JobsPanel: (props: { onFirstPaintReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      const timeoutId = window.setTimeout(() => {
        props.onFirstPaintReadyChange?.(jobsFirstPaintReady);
      }, jobsResponseDelayMs);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, []);

    return <div data-testid="jobs-panel">Jobs panel</div>;
  },
  fetchJobsState: vi.fn(() => new Promise(() => {})),
  getStoredJobsLockReleaseAtMs: vi.fn(() => null)
}));

vi.mock("../src/features/refinery", () => ({
  RefineryPanel: (props: { onFirstPaintReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      const timeoutId = window.setTimeout(() => {
        props.onFirstPaintReadyChange?.(refineryFirstPaintReady);
      }, refineryResponseDelayMs);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, []);

    return <div data-testid="refinery-panel">Refinery panel</div>;
  }
}));

vi.mock("../src/features/leaderboard", () => ({
  Leaderboard: (props: { onFirstPaintReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      props.onFirstPaintReadyChange?.(leaderboardFirstPaintReady);
    }, [props.onFirstPaintReadyChange]);

    return <div data-testid="leaderboards-panel">Leaderboards panel</div>;
  }
}));

vi.mock("../src/features/guild", () => ({
  GuildPanel: (props: {
    requestedTab?: string | null;
    onFirstPaintReadyChange?: (ready: boolean) => void;
  }) => {
    useEffect(() => {
      const timeoutId = window.setTimeout(() => {
        props.onFirstPaintReadyChange?.(missionsFirstPaintReady);
      }, missionsResponseDelayMs);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, []);

    return (
      <div data-testid={props.requestedTab === "missions" ? "missions-panel" : "guild-panel"}>
        {props.requestedTab === "missions" ? "Missions panel" : "Guild panel"}
      </div>
    );
  }
}));

vi.mock("../src/features/arena", () => ({
  ArenaPanel: (props: { onFirstPaintReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      const timeoutId = window.setTimeout(() => {
        props.onFirstPaintReadyChange?.(arenaFirstPaintReady);
      }, arenaResponseDelayMs);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, []);

    return <div data-testid="arena-panel">Arena panel</div>;
  }
}));

vi.mock("../src/features/auction", () => ({
  AuctionHouse: (props: { onFirstPaintReadyChange?: (ready: boolean) => void }) => {
    useEffect(() => {
      const timeoutId = window.setTimeout(() => {
        props.onFirstPaintReadyChange?.(auctionHouseFirstPaintReady);
      }, auctionHouseResponseDelayMs);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, []);

    return <div data-testid="auction-house-panel">Auction house panel</div>;
  }
}));

vi.mock("../src/lib/viewBackgrounds", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/viewBackgrounds")>("../src/lib/viewBackgrounds");

  return {
    ...actual,
    preloadImageAssets: vi.fn(() => Promise.resolve())
  };
});

vi.mock("../src/features/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/features/profile")>("../src/features/profile");

  return {
    ...actual,
    InventoryManagementPanel: (props: { renderCharacterHubTabs: () => JSX.Element }) => (
      <div data-testid="character-panel">
        {props.renderCharacterHubTabs()}
        <div>Character panel</div>
      </div>
    ),
    ProfileSidePanel: () => <div data-testid="profile-side-panel">Profile side panel</div>,
    RenownPanel: (props: { renderCharacterHubTabs: () => JSX.Element }) => (
      <div data-testid="renown-panel">
        {props.renderCharacterHubTabs()}
        <div>Renown panel</div>
      </div>
    ),
    EncyclopediaPanel: (props: { renderCharacterHubTabs?: () => JSX.Element }) => (
      <div data-testid="encyclopedia-panel">
        {props.renderCharacterHubTabs ? props.renderCharacterHubTabs() : null}
        <div>Encyclopedia panel</div>
      </div>
    ),
    getMyRenownState: vi.fn(() => new Promise(() => {})),
    unlockRenownNodeApi: vi.fn(() => new Promise(() => {}))
  };
});

import {
  AppShell,
  PANEL_READY_BUDGET_MS,
  PANEL_REVEAL_MS
} from "../src/app/AppShell";

function presentedLayer() {
  return within(screen.getByTestId("panel-transition-presented"));
}

function preloadLayer() {
  return within(screen.getByTestId("panel-transition-preload"));
}

describe("AppShell panel transitions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.setItem("ebonkeep.dev.token", "test-token");
    gardenFirstPaintReady = false;
    gardenResponseDelayMs = 0;
    jobsFirstPaintReady = false;
    jobsResponseDelayMs = 0;
    refineryFirstPaintReady = false;
    refineryResponseDelayMs = 0;
    leaderboardFirstPaintReady = true;
    missionsFirstPaintReady = false;
    missionsResponseDelayMs = 0;
    arenaFirstPaintReady = false;
    arenaResponseDelayMs = 0;
    auctionHouseFirstPaintReady = false;
    auctionHouseResponseDelayMs = 0;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps the current panel visible while a ready menu target preloads, then reveals it before the fallback budget", async () => {
    render(<AppShell />);

    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("idle");

    fireEvent.click(screen.getByTestId("menu-leaderboards"));

    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("preparing");
    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(preloadLayer().getByTestId("leaderboards-panel")).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
    });

    expect(presentedLayer().getByTestId("leaderboards-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("revealing");

    act(() => {
      vi.advanceTimersByTime(PANEL_REVEAL_MS);
    });

    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("idle");
  });

  it("keeps the garden panel hidden past the readiness budget until the server response settles", async () => {
    gardenFirstPaintReady = true;
    gardenResponseDelayMs = PANEL_READY_BUDGET_MS + 200;

    render(<AppShell />);

    fireEvent.click(screen.getByTestId("menu-group-estate"));
    fireEvent.click(screen.getByTestId("menu-garden"));

    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(preloadLayer().getByTestId("garden-panel")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(PANEL_READY_BUDGET_MS + 100);
    });

    expect(presentedLayer().queryByTestId("garden-panel")).toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("preparing");

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(presentedLayer().getByTestId("garden-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("revealing");
  });

  it("keeps the jobs panel hidden until the jobs response settles", async () => {
    jobsFirstPaintReady = true;
    jobsResponseDelayMs = PANEL_READY_BUDGET_MS + 250;

    render(<AppShell />);

    fireEvent.click(screen.getByTestId("menu-group-estate"));
    fireEvent.click(screen.getByTestId("menu-jobs"));

    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(preloadLayer().getByTestId("jobs-panel")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(PANEL_READY_BUDGET_MS + 150);
    });

    expect(presentedLayer().queryByTestId("jobs-panel")).toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("preparing");

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(presentedLayer().getByTestId("jobs-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("revealing");
  });

  it("keeps the refinery panel hidden until the refinery response settles", async () => {
    refineryFirstPaintReady = true;
    refineryResponseDelayMs = PANEL_READY_BUDGET_MS + 250;

    render(<AppShell />);

    fireEvent.click(screen.getByTestId("menu-group-estate"));
    fireEvent.click(screen.getByTestId("menu-refinery"));

    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(preloadLayer().getByTestId("refinery-panel")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(PANEL_READY_BUDGET_MS + 150);
    });

    expect(presentedLayer().queryByTestId("refinery-panel")).toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("preparing");

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(presentedLayer().getByTestId("refinery-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("revealing");
  });

  it("keeps the missions panel hidden until the missions response settles", async () => {
    missionsFirstPaintReady = true;
    missionsResponseDelayMs = PANEL_READY_BUDGET_MS + 250;

    render(<AppShell />);

    fireEvent.click(screen.getByTestId("menu-group-adventures"));
    fireEvent.click(screen.getByTestId("menu-missions"));

    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(preloadLayer().getByTestId("missions-panel")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(PANEL_READY_BUDGET_MS + 150);
    });

    expect(presentedLayer().queryByTestId("missions-panel")).toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("preparing");

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(presentedLayer().getByTestId("missions-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("revealing");
  });

  it("keeps the arena panel hidden until the arena response settles", async () => {
    arenaFirstPaintReady = true;
    arenaResponseDelayMs = PANEL_READY_BUDGET_MS + 250;

    render(<AppShell />);

    fireEvent.click(screen.getByTestId("menu-group-adventures"));
    fireEvent.click(screen.getByTestId("menu-arena"));

    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(preloadLayer().getByTestId("arena-panel")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(PANEL_READY_BUDGET_MS + 150);
    });

    expect(presentedLayer().queryByTestId("arena-panel")).toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("preparing");

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(presentedLayer().getByTestId("arena-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("revealing");
  });

  it("keeps the auction house panel hidden until the auction response settles", async () => {
    auctionHouseFirstPaintReady = true;
    auctionHouseResponseDelayMs = PANEL_READY_BUDGET_MS + 250;

    render(<AppShell />);

    fireEvent.click(screen.getByTestId("menu-group-market"));
    fireEvent.click(screen.getByTestId("menu-auctionHouse"));

    expect(presentedLayer().getByTestId("character-panel")).not.toBeNull();
    expect(preloadLayer().getByTestId("auction-house-panel")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(PANEL_READY_BUDGET_MS + 150);
    });

    expect(presentedLayer().queryByTestId("auction-house-panel")).toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("preparing");

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(presentedLayer().getByTestId("auction-house-panel")).not.toBeNull();
    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).toBe("revealing");
  });

  it("routes character hub transitions through the same requested and presented handoff", async () => {
    render(<AppShell />);

    fireEvent.click(presentedLayer().getByTestId("character-hub-tab-ledger"));

    expect(screen.getByTestId("panel-transition-overlay").getAttribute("data-phase")).not.toBe("idle");

    await act(async () => {
      await Promise.resolve();
    });

    expect(presentedLayer().queryByTestId("character-panel")).toBeNull();
    expect(presentedLayer().getByRole("heading", { name: "Ledger" })).not.toBeNull();
  });
});
