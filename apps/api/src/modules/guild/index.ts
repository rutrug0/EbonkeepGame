/**
 * Guild module main exports
 * Combines all guild service functions
 */

// Core CRUD operations
export {
  createGuild,
  getGuild,
  updateGuild,
  searchGuilds,
  disbandGuild
} from "./service.js";

// Member management
export {
  joinGuild,
  getGuildMembers,
  leaveGuild,
  kickMember,
  updateMemberRole,
  transferLeadership,
  recalculateGuildPower
} from "./service-members.js";

// Invite system
export {
  getReceivedInvites,
  sendGuildInvite,
  acceptGuildInvite,
  declineGuildInvite,
  cancelGuildInvite,
  cleanupExpiredInvites
} from "./service-invites.js";

// Activity and leaderboards
export {
  logGuildActivity,
  getGuildActivity,
  getGuildLeaderboard,
  getGuildMemberLeaderboard,
  pruneOldActivity,
  getGuildStats
} from "./service-activity.js";

// Raid bosses
export {
  getGuildRaidState,
  summonGuildRaid,
  joinGuildRaid,
  leaveGuildRaid,
  commenceGuildRaidNow
} from "./service-raids.js";

// Validation
export {
  validateGuildName,
  validateGuildTag,
  validateGuildDescription,
  validateGuildCrestId,
  VALID_CREST_IDS
} from "./validation.js";

// Permissions
export {
  checkGuildPermission,
  canKickMember,
  canChangeRole,
  canTransferLeadership,
  canLeaveGuild,
  canDisbandGuild,
  canEditGuildSettings,
  canSendInvites
} from "./permissions.js";
