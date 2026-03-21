import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetGuildPanelCacheForTests, GuildPanel } from "../src/features/guild/GuildPanel";

const guildApiMocks = vi.hoisted(() => ({
  getMyGuild: vi.fn(),
  createGuild: vi.fn(),
  getGuildMembers: vi.fn(),
  getGuildActivity: vi.fn(),
  searchGuilds: vi.fn(),
  leaveGuild: vi.fn(),
  disbandGuild: vi.fn(),
  updateGuild: vi.fn(),
  joinGuild: vi.fn(),
  getReceivedInvites: vi.fn(),
  acceptGuildInvite: vi.fn(),
  declineGuildInvite: vi.fn(),
  kickMember: vi.fn(),
  updateMemberRole: vi.fn(),
  transferLeadership: vi.fn(),
  sendGuildInvite: vi.fn()
}));

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => {}
  },
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock("../src/features/guild/api", () => ({
  createGuild: guildApiMocks.createGuild,
  getMyGuild: guildApiMocks.getMyGuild,
  getGuildMembers: guildApiMocks.getGuildMembers,
  getGuildActivity: guildApiMocks.getGuildActivity,
  searchGuilds: guildApiMocks.searchGuilds,
  leaveGuild: guildApiMocks.leaveGuild,
  disbandGuild: guildApiMocks.disbandGuild,
  updateGuild: guildApiMocks.updateGuild,
  joinGuild: guildApiMocks.joinGuild,
  getReceivedInvites: guildApiMocks.getReceivedInvites,
  acceptGuildInvite: guildApiMocks.acceptGuildInvite,
  declineGuildInvite: guildApiMocks.declineGuildInvite,
  kickMember: guildApiMocks.kickMember,
  updateMemberRole: guildApiMocks.updateMemberRole,
  transferLeadership: guildApiMocks.transferLeadership,
  sendGuildInvite: guildApiMocks.sendGuildInvite
}));

vi.mock("../src/features/guild/GuildMissions", () => ({
  GuildMissions: () => <div>missions-panel</div>
}));

vi.mock("../src/features/guild/GuildList", () => ({
  GuildCrestDisplay: () => <div>guild-crest</div>
}));

function createGuildData() {
  return {
    guild: {
      id: "guild_1",
      crestId: "wolfpack",
      name: "Ashen Guard",
      tag: "ASH",
      level: 12,
      maxMembers: 30,
      isRecruiting: true,
      totalPower: 4200,
      description: "Ready for missions."
    },
    memberCount: 12,
    currentUserMembership: {
      role: "leader"
    }
  };
}

describe("guild panel", () => {
  beforeEach(() => {
    __resetGuildPanelCacheForTests();
    guildApiMocks.getMyGuild.mockReset();
    guildApiMocks.createGuild.mockReset();
    guildApiMocks.getGuildMembers.mockReset();
    guildApiMocks.getGuildActivity.mockReset();
    guildApiMocks.searchGuilds.mockReset();
    guildApiMocks.leaveGuild.mockReset();
    guildApiMocks.disbandGuild.mockReset();
    guildApiMocks.updateGuild.mockReset();
    guildApiMocks.joinGuild.mockReset();
    guildApiMocks.getReceivedInvites.mockReset();
    guildApiMocks.acceptGuildInvite.mockReset();
    guildApiMocks.declineGuildInvite.mockReset();
    guildApiMocks.kickMember.mockReset();
    guildApiMocks.updateMemberRole.mockReset();
    guildApiMocks.transferLeadership.mockReset();
    guildApiMocks.sendGuildInvite.mockReset();
  });

  it("reuses the warm guild response on remount without flashing the loading shell", async () => {
    guildApiMocks.getMyGuild
      .mockResolvedValueOnce(createGuildData())
      .mockResolvedValueOnce(createGuildData())
      .mockImplementation(() => new Promise(() => {}));

    const firstRender = render(<GuildPanel token="token" requestedTab="missions" />);

    expect(await screen.findByText("Ashen Guard")).toBeTruthy();
    expect(screen.getByText("missions-panel")).toBeTruthy();

    firstRender.unmount();

    render(<GuildPanel token="token" requestedTab="missions" />);

    expect(screen.queryByText("loading")).toBeNull();
    expect(screen.getByText("Ashen Guard")).toBeTruthy();
    expect(screen.getByText("missions-panel")).toBeTruthy();
  });
});
