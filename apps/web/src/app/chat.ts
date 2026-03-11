import type { ChatChannel } from "./navigation";

export type ChatMessage = {
  id: string;
  channel: ChatChannel;
  sender: string;
  text: string;
  sentAtMs: number;
};

export function formatChatTime(sentAtMs: number): string {
  const sentAt = new Date(sentAtMs);
  const hours = sentAt.getHours().toString().padStart(2, "0");
  const minutes = sentAt.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function createInitialChatMessages(nowMs: number = Date.now()): Record<ChatChannel, ChatMessage[]> {
  return {
    world: [
      {
        id: "world-seed-1",
        channel: "world",
        sender: "Town Crier",
        text: "World bosses are stirring near Dreadmoor.",
        sentAtMs: nowMs - 5 * 60 * 1000
      },
      {
        id: "world-seed-2",
        channel: "world",
        sender: "Mercenary-Rin",
        text: "Selling rare iron bundles, whisper me.",
        sentAtMs: nowMs - 3 * 60 * 1000
      },
      {
        id: "world-seed-3",
        channel: "world",
        sender: "Archmage Sol",
        text: "Need one more for hard contract chain.",
        sentAtMs: nowMs - 90 * 1000
      }
    ],
    guild: [
      {
        id: "guild-seed-1",
        channel: "guild",
        sender: "Guildmaster",
        text: "Guild reset at dawn. Donate materials before then.",
        sentAtMs: nowMs - 6 * 60 * 1000
      },
      {
        id: "guild-seed-2",
        channel: "guild",
        sender: "Quartermaster",
        text: "Bench upgrades are queued after tonight's run.",
        sentAtMs: nowMs - 2 * 60 * 1000
      }
    ]
  };
}
