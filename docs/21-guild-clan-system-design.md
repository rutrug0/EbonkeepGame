# Guild (Clan) System - Complete Design Specification

**Document Version:** 1.0  
**Author:** Senior Full-Stack Team  
**Created:** March 10, 2026  
**Status:** Design Phase Ready for Implementation

---

## Executive Summary

This document specifies a complete guild/clan system for Ebonkeep, designed for production deployment with focus on scalability, anti-abuse, medieval aesthetics, and maintainability.

**Core Features:**
- Guild lifecycle management (create, join, leave, disband)
- Role-based permission system (Leader, Officer, Member)
- Invite system with expiry and rate limiting
- Composable crest generation system (no user uploads)
- Guild leaderboards integration
- Activity logging and audit trail
- Multi-language support (7 locales)
- Anti-abuse protections

**Timeline Estimate:** 3-4 weeks for full implementation  
**Database Impact:** 6 new tables, moderate migration complexity  
**API Surface:** ~15 new endpoints

---

## 1. System Architecture Overview

### 1.1 Module Structure

```
apps/api/src/modules/guild/
├── routes.ts              # Fastify route definitions
├── service.ts             # Core business logic
├── permissions.ts         # Role permission checks
├── crest-generator.ts     # Crest composition service
├── validation.ts          # Guild name/tag validators
└── rate-limiters.ts       # Anti-spam protections

apps/web/src/components/
├── Guild/
│   ├── GuildOverview.tsx       # Main guild dashboard
│   ├── GuildMemberList.tsx     # Member management
│   ├── GuildInvitePanel.tsx    # Send/accept invites
│   ├── GuildCrestEditor.tsx    # Crest composer
│   ├── GuildSettings.tsx       # Leader/officer settings
│   └── GuildActivityLog.tsx    # Activity feed

packages/shared/src/
└── index.ts                    # Zod schemas for guild types
```

### 1.2 Data Flow

```
Player → Frontend Component → API Route → Service Layer → Prisma → PostgreSQL
                                              ↓
                                      Permission Check
                                      Rate Limit Check
                                      Validation
```

### 1.3 Integration Points

- **Leaderboard System:** Guild leaderboard rankings (total power, member count)
- **Player Profile:** Display guild tag + crest badge
- **Chat System:** (Future) Guild-only channels
- **Events:** (Future) Guild-based events/wars

---

## 2. Database Schema

### 2.1 Prisma Schema

```prisma
model Guild {
  id              String          @id @default(cuid())
  name            String          @unique
  tag             String          @unique  // 2-6 uppercase letters
  description     String          @default("")
  leaderId        String
  maxMembers      Int             @default(50)
  isRecruiting    Boolean         @default(true)
  totalPower      Int             @default(0)  // Sum of member gearScores
  level           Int             @default(1)   // Future: guild XP system
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  // Crest composition
  crestBgShape    String          @default("shield_01")
  crestBgColor    String          @default("crimson")
  crestBgPattern  String?         // Optional texture
  crestFgSymbol   String          @default("sword_01")
  crestFgColor    String          @default("gold")
  crestFrame      String?         // Optional border
  
  leader          PlayerProfile   @relation("GuildLeader", fields: [leaderId], references: [id], onDelete: Restrict)
  members         GuildMember[]
  invites         GuildInvite[]
  activityLog     GuildActivity[]
  
  @@index([name])
  @@index([tag])
  @@index([leaderId])
  @@index([totalPower])
  @@index([createdAt])
  @@map("guilds")
}

model GuildMember {
  id              String          @id @default(cuid())
  guildId         String
  playerId        String          @unique  // One guild per player
  role            String          @default("member")  // leader, officer, member
  joinedAt        DateTime        @default(now())
  contributedPower Int            @default(0)  // Player's gearScore snapshot
  
  guild           Guild           @relation(fields: [guildId], references: [id], onDelete: Cascade)
  player          PlayerProfile   @relation("GuildMembership", fields: [playerId], references: [id], onDelete: Cascade)
  
  @@index([guildId])
  @@index([playerId])
  @@index([role])
  @@map("guild_members")
}

model GuildInvite {
  id              String          @id @default(cuid())
  guildId         String
  inviterId       String
  inviteeId       String
  message         String?
  status          String          @default("pending")  // pending, accepted, declined, expired
  expiresAt       DateTime
  createdAt       DateTime        @default(now())
  respondedAt     DateTime?
  
  guild           Guild           @relation(fields: [guildId], references: [id], onDelete: Cascade)
  inviter         PlayerProfile   @relation("GuildInvitesSent", fields: [inviterId], references: [id], onDelete: Cascade)
  invitee         PlayerProfile   @relation("GuildInvitesReceived", fields: [inviteeId], references: [id], onDelete: Cascade)
  
  @@unique([guildId, inviteeId, status])  // Prevent duplicate pending invites
  @@index([guildId])
  @@index([inviteeId, status])
  @@index([expiresAt])
  @@map("guild_invites")
}

model GuildActivity {
  id              String          @id @default(cuid())
  guildId         String
  actorId         String?         // Nullable for system events
  actionType      String          // created, joined, left, kicked, promoted, demoted, disbanded, etc.
  targetId        String?         // Player affected (for kick/promote)
  metadata        Json?           // Additional context
  timestamp       DateTime        @default(now())
  
  guild           Guild           @relation(fields: [guildId], references: [id], onDelete: Cascade)
  actor           PlayerProfile?  @relation("GuildActivityActor", fields: [actorId], references: [id], onDelete: SetNull)
  target          PlayerProfile?  @relation("GuildActivityTarget", fields: [targetId], references: [id], onDelete: SetNull)
  
  @@index([guildId, timestamp(sort: Desc)])
  @@index([actorId])
  @@map("guild_activity")
}

model PlayerProfile {
  // ... existing fields ...
  
  guildMembership      GuildMember?        @relation("GuildMembership")
  leadingGuild         Guild[]             @relation("GuildLeader")
  sentInvites          GuildInvite[]       @relation("GuildInvitesSent")
  receivedInvites      GuildInvite[]       @relation("GuildInvitesReceived")
  guildActivityAsActor GuildActivity[]     @relation("GuildActivityActor")
  guildActivityAsTarget GuildActivity[]    @relation("GuildActivityTarget")
}
```

### 2.2 Indexes Strategy

**High-traffic queries:**
- `guilds(name)` - Guild search/uniqueness
- `guilds(totalPower)` - Leaderboard rankings
- `guild_members(playerId)` - Check player's guild
- `guild_invites(inviteeId, status)` - Pending invites notification
- `guild_activity(guildId, timestamp DESC)` - Recent activity feed

**Index size estimates (10k guilds, 100k members):**
- `guilds` table: ~2 MB
- `guild_members` indexes: ~8 MB
- `guild_invites` indexes: ~12 MB (will grow, needs periodic cleanup)

### 2.3 Migration Strategy

```sql
-- Step 1: Create tables (low risk)
CREATE TABLE guilds (...);
CREATE TABLE guild_members (...);
CREATE TABLE guild_invites (...);
CREATE TABLE guild_activity (...);

-- Step 2: Add PlayerProfile relations (medium risk)
-- Run during maintenance window
-- Estimated downtime: < 5 minutes

-- Step 3: Backfill data (if needed)
-- No backfill needed - fresh system

-- Step 4: Enable constraints
-- After validation period
```

---

## 3. API Endpoints

### 3.1 Guild Management

```typescript
POST   /v1/guild/create
  Body: { name, tag, description?, crestConfig }
  Auth: Required
  Response: { guild: Guild, membership: GuildMember }
  Rate Limit: 1 per 24h per account

GET    /v1/guild/:guildId
  Auth: Optional (public info)
  Response: { guild: Guild, memberCount, topMembers[] }

PATCH  /v1/guild/:guildId
  Body: { description?, crestConfig?, isRecruiting? }
  Auth: Required (Leader/Officer)
  Response: { guild: Guild }

DELETE /v1/guild/:guildId/disband
  Auth: Required (Leader only)
  Response: { success: true }
  
GET    /v1/guild/search
  Query: { name?, tag?, minMembers?, maxMembers?, limit?, offset? }
  Auth: Optional
  Response: { guilds: Guild[], total }
```

### 3.2 Member Management

```typescript
GET    /v1/guild/:guildId/members
  Query: { role?, limit?, offset? }
  Auth: Required (Guild member)
  Response: { members: (GuildMember & { player })[], total }

POST   /v1/guild/:guildId/leave
  Auth: Required (Member, not Leader)
  Response: { success: true }

DELETE /v1/guild/:guildId/members/:playerId/kick
  Auth: Required (Leader/Officer, target is Member)
  Response: { success: true }

PATCH  /v1/guild/:guildId/members/:playerId/role
  Body: { role: "officer" | "member" }
  Auth: Required (Leader only)
  Response: { member: GuildMember }

POST   /v1/guild/:guildId/transfer-leadership
  Body: { newLeaderId: string }
  Auth: Required (Leader only)
  Response: { success: true }
```

### 3.3 Invite System

```typescript
POST   /v1/guild/:guildId/invites
  Body: { inviteeId: string, message?: string }
  Auth: Required (Leader/Officer)
  Rate Limit: 10 per hour per guild
  Response: { invite: GuildInvite }

GET    /v1/guild/invites/received
  Query: { status?: "pending" | "all" }
  Auth: Required
  Response: { invites: (GuildInvite & { guild })[] }

POST   /v1/guild/invites/:inviteId/accept
  Auth: Required (Invitee only)
  Response: { membership: GuildMember }

POST   /v1/guild/invites/:inviteId/decline
  Auth: Required (Invitee only)
  Response: { success: true }

DELETE /v1/guild/:guildId/invites/:inviteId/cancel
  Auth: Required (Inviter or Leader)
  Response: { success: true }
```

### 3.4 Activity & Leaderboards

```typescript
GET    /v1/guild/:guildId/activity
  Query: { limit?: number, offset?: number }
  Auth: Required (Guild member)
  Response: { activities: (GuildActivity & { actor?, target? })[] }

GET    /v1/guild/leaderboards
  Query: { type: "power" | "memberCount" | "level", limit?, classFilter? }
  Auth: Optional
  Response: { guilds: Guild[], totalGuilds }
```

### 3.5 Error Codes

```typescript
400 INVALID_GUILD_NAME        // Profanity, length, format
400 INVALID_GUILD_TAG         // Not 2-6 uppercase letters
409 GUILD_NAME_TAKEN
409 GUILD_TAG_TAKEN
409 ALREADY_IN_GUILD
404 GUILD_NOT_FOUND
404 INVITE_NOT_FOUND
403 INSUFFICIENT_PERMISSIONS
403 CANNOT_LEAVE_AS_LEADER    // Must transfer or disband
429 RATE_LIMIT_EXCEEDED
400 GUILD_FULL
410 INVITE_EXPIRED
```

---

## 4. Permission System

### 4.1 Role Hierarchy

```typescript
enum GuildRole {
  LEADER = "leader",    // One per guild, full control
  OFFICER = "officer",  // Multiple, elevated permissions
  MEMBER = "member"     // Default role
}
```

### 4.2 Permission Matrix

| Action | Leader | Officer | Member |
|--------|--------|---------|--------|
| View guild info | ✅ | ✅ | ✅ |
| View members | ✅ | ✅ | ✅ |
| View activity log | ✅ | ✅ | ✅ |
| Edit description | ✅ | ✅ | ❌ |
| Edit crest | ✅ | ✅ | ❌ |
| Toggle recruiting | ✅ | ✅ | ❌ |
| Send invites | ✅ | ✅ | ❌ |
| Cancel invites | ✅ | ✅ | Own only |
| Kick members | ✅ | Officers only¹ | ❌ |
| Promote to officer | ✅ | ❌ | ❌ |
| Demote officer | ✅ | ❌ | ❌ |
| Transfer leadership | ✅ | ❌ | ❌ |
| Disband guild | ✅ | ❌ | ❌ |
| Leave guild | Must transfer² | ✅ | ✅ |

¹ Officers can only kick members, not other officers  
² Leaders must transfer leadership or disband before leaving

### 4.3 Permission Check Implementation

```typescript
// apps/api/src/modules/guild/permissions.ts
export async function checkGuildPermission(
  prisma: PrismaClient,
  guildId: string,
  playerId: string,
  requiredRole: "leader" | "officer" | "member"
): Promise<{ allowed: boolean; membership?: GuildMember }> {
  const membership = await prisma.guildMember.findFirst({
    where: { guildId, playerId }
  });

  if (!membership) {
    return { allowed: false };
  }

  const roleHierarchy = { leader: 3, officer: 2, member: 1 };
  const hasPermission = roleHierarchy[membership.role] >= roleHierarchy[requiredRole];

  return { allowed: hasPermission, membership };
}

export async function canKickMember(
  kicker: GuildMember,
  target: GuildMember
): Promise<boolean> {
  // Cannot kick yourself
  if (kicker.playerId === target.playerId) return false;
  
  // Cannot kick leader
  if (target.role === "leader") return false;
  
  // Leader can kick anyone
  if (kicker.role === "leader") return true;
  
  // Officer can only kick members
  if (kicker.role === "officer" && target.role === "member") return true;
  
  return false;
}
```

---

## 5. Guild Crest System

### 5.1 Composable Asset Architecture

**No user uploads - only predefined combinations**

```typescript
interface GuildCrest {
  // Background layer (required)
  bgShape: string;      // "shield_01", "banner_01", "circle_01"
  bgColor: string;      // "crimson", "forest", "gold", "iron"
  bgPattern?: string;   // "stripes", "checkered", "embossed"
  
  // Foreground symbol (required)
  fgSymbol: string;     // "sword_01", "dragon_01", "castle_01"
  fgColor: string;      // "gold", "silver", "ivory"
  
  // Decoration (optional)
  frame?: string;       // "ornate_01", "simple_01", "thorns_01"
}
```

### 5.2 Asset Pool Structure

```
tools/crest-assets/
├── backgrounds/
│   ├── shields/
│   │   ├── shield_01_base.png       (256x256px)
│   │   ├── shield_02_tall.png
│   │   └── shield_03_round.png
│   ├── banners/
│   │   ├── banner_01_vertical.png
│   │   └── banner_02_flowing.png
│   └── emblems/
│       └── circle_01.png
├── symbols/
│   ├── weapons/
│   │   ├── sword_01.png
│   │   ├── axe_01.png
│   │   └── bow_01.png
│   ├── creatures/
│   │   ├── dragon_01.png
│   │   ├── wolf_01.png
│   │   └── eagle_01.png
│   └── structures/
│       ├── castle_01.png
│       └── tower_01.png
├── patterns/
│   ├── stripes_horizontal.png       (overlay masks)
│   ├── checkered.png
│   └── embossed_texture.png
├── frames/
│   ├── ornate_01.png                (border overlay)
│   ├── simple_border.png
│   └── thorns_frame.png
└── colors/
    └── palettes.json                (color definitions)
```

### 5.3 Color Palette (Medieval Heraldic)

```json
{
  "backgrounds": {
    "crimson": "#8B2635",
    "forest": "#2D4F2F",
    "sapphire": "#1B4965",
    "obsidian": "#1A1B26",
    "ivory": "#E8DCC4",
    "gold": "#C9A961",
    "iron": "#54575E"
  },
  "foregrounds": {
    "gold": "#D4AF37",
    "silver": "#C0C0C0",
    "ivory": "#F0E8D7",
    "obsidian": "#1A1B26",
    "crimson": "#A73144"
  }
}
```

**Design Principles:**
- Muted, earthy tones
- No bright neon (no #00FF00, #FF00FF)
- High contrast between bg/fg for readability
- Maximum 2-3 colors per crest (avoid visual clutter)

### 5.4 Crest Rendering Pipeline

**Backend Storage:**
```typescript
// Stored in Guild table as discrete fields
{
  crestBgShape: "shield_01",
  crestBgColor: "crimson",
  crestBgPattern: null,
  crestFgSymbol: "dragon_01",
  crestFgColor: "gold",
  crestFrame: "ornate_01"
}
```

**Frontend Rendering:**
```typescript
// Method 1: CSS Background Layers (fast, cacheable)
<div className="guildCrest" style={{
  backgroundImage: `
    url(/crest-assets/frames/${frame}.png),
    url(/crest-assets/symbols/${fgSymbol}.png),
    url(/crest-assets/patterns/${bgPattern}.png),
    url(/crest-assets/backgrounds/${bgShape}.png)
  `,
  filter: `hue-rotate(${colorToHue(bgColor)}deg)`,
  // Foreground color applied via separate mask layer
}} />

// Method 2: Canvas Rendering (for complex color tinting)
function renderCrest(crest: GuildCrest): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 256;
  
  // 1. Draw background shape with color tint
  const bgImg = await loadImage(`/crest-assets/backgrounds/${crest.bgShape}.png`);
  ctx.fillStyle = COLORS.backgrounds[crest.bgColor];
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(bgImg, 0, 0);
  
  // 2. Draw pattern overlay (if exists)
  if (crest.bgPattern) {
    ctx.globalCompositeOperation = 'overlay';
    const patternImg = await loadImage(`/crest-assets/patterns/${crest.bgPattern}.png`);
    ctx.drawImage(patternImg, 0, 0);
  }
  
  // 3. Draw foreground symbol
  ctx.globalCompositeOperation = 'source-over';
  const symbolImg = await loadImage(`/crest-assets/symbols/${crest.fgSymbol}.png`);
  ctx.fillStyle = COLORS.foregrounds[crest.fgColor];
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(symbolImg, 0, 0);
  
  // 4. Draw frame border
  if (crest.frame) {
    ctx.globalCompositeOperation = 'source-over';
    const frameImg = await loadImage(`/crest-assets/frames/${crest.frame}.png`);
    ctx.drawImage(frameImg, 0, 0);
  }
  
  return canvas;
}
```

**Caching Strategy:**
```typescript
// Server-side: Pre-render common combinations on crest save
POST /v1/guild/:guildId/crest/update
  → Triggers background job: render to /crest-cache/${guildId}.webp
  → Store in CDN/S3
  → Invalidate old cache

// Client-side: Cache rendered canvas as blob URL
const crestCache = new Map<string, string>(); // guildId → blobUrl

function getCrestUrl(guildId: string, crest: GuildCrest): string {
  const cacheKey = `${guildId}_${JSON.stringify(crest)}`;
  if (crestCache.has(cacheKey)) {
    return crestCache.get(cacheKey)!;
  }
  
  const canvas = renderCrest(crest);
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    crestCache.set(cacheKey, url);
  });
}
```

### 5.5 Asset Generation (AI Prompts)

**Pool-based approach - not player-specific**

```yaml
# tools/crest-assets/generation-prompts.yaml

backgrounds:
  - prompt: |
      medieval heraldic shield shape, simple geometric form, 
      flat color fill ready for tinting, clean edges, 
      game UI asset style, 256x256px, transparent background,
      parchment texture, hand-painted fantasy RPG icon
    variations: 5
    output: backgrounds/shields/shield_{01-05}_base.png

symbols:
  - category: weapons
    prompts:
      - prompt: |
          medieval longsword icon, centered composition, 
          sharp silhouette for emblem use, single color layer,
          game UI fantasy asset, 256x256px transparent,
          detailed blade and crossguard, heraldic style
        output: symbols/weapons/sword_01.png
      
      - prompt: |
          battle axe icon, medieval fantasy weapon,
          bold silhouette, heraldic emblem style,
          game asset, centered, 256x256px transparent
        output: symbols/weapons/axe_01.png
  
  - category: creatures
    prompts:
      - prompt: |
          stylized dragon head profile, medieval heraldic emblem,
          fierce expression, clean silhouette for crest icon,
          fantasy game UI asset, 256x256px transparent,
          bold lines, suitable for color fill
        output: symbols/creatures/dragon_01.png

frames:
  - prompt: |
      ornate medieval border frame, decorative flourishes,
      gothic style corners, empty center, 256x256px,
      transparent background, gold embossing style,
      game UI fantasy asset
    output: frames/ornate_01.png
```

**Generation Workflow:**
1. Art director defines 20-30 base prompts
2. Batch generate via Stable Diffusion / Midjourney
3. Manual QA: check style consistency, remove unusable outputs
4. Post-process: resize to 256x256, extract alpha channel
5. Catalog in `tools/crest-assets/manifest.json`
6. Import to frontend via `build_crest_manifest.py` script

**Estimated Asset Count:**
- Backgrounds: 15 shapes
- Symbols: 40-50 (weapons, creatures, structures)
- Patterns: 10 overlays
- Frames: 8 borders
- **Total Combinations:** ~40,000+ unique crests

### 5.6 Validation Rules

```typescript
// Guild crest must not violate asset pool
const VALID_BG_SHAPES = ["shield_01", "shield_02", "banner_01", ...];
const VALID_SYMBOLS = ["sword_01", "dragon_01", "castle_01", ...];
const VALID_COLORS = Object.keys(COLOR_PALETTE.backgrounds);

export function validateCrest(crest: GuildCrest): boolean {
  if (!VALID_BG_SHAPES.includes(crest.bgShape)) return false;
  if (!VALID_SYMBOLS.includes(crest.fgSymbol)) return false;
  if (!VALID_COLORS.includes(crest.bgColor)) return false;
  if (!VALID_COLORS.includes(crest.fgColor)) return false;
  
  // Prevent low-contrast combinations
  if (crest.bgColor === crest.fgColor) return false;
  if (crest.bgColor === "ivory" && crest.fgColor === "silver") return false;
  
  return true;
}
```

---

## 6. Frontend UI Structure

### 6.1 Guild Overview Panel

```typescript
// apps/web/src/components/Guild/GuildOverview.tsx
interface GuildOverviewProps {
  token: string;
  guildId: string;
}

export function GuildOverview({ token, guildId }: GuildOverviewProps) {
  const { t } = useTranslation("common");
  const [guild, setGuild] = useState<Guild | null>(null);
  const [members, setMembers] = useState<GuildMember[]>([]);
  
  return (
    <div className="guildOverview">
      {/* Header */}
      <div className="guildHeader">
        <div className="guildCrest" data-crest={guild?.id} />
        <div className="guildInfo">
          <h2>[{guild?.tag}] {guild?.name}</h2>
          <p>{guild?.description}</p>
          <div className="guildStats">
            <span>{t("guild.memberCount", { count: members.length, max: guild?.maxMembers })}</span>
            <span>{t("guild.totalPower")}: {guild?.totalPower}</span>
            <span>{t("guild.level")}: {guild?.level}</span>
          </div>
        </div>
        {canManage && <button onClick={openSettings}>{t("guild.settings")}</button>}
      </div>
      
      {/* Tabs */}
      <Tabs>
        <Tab label={t("guild.tab.members")}>
          <GuildMemberList guildId={guildId} token={token} />
        </Tab>
        <Tab label={t("guild.tab.activity")}>
          <GuildActivityLog guildId={guildId} token={token} />
        </Tab>
        <Tab label={t("guild.tab.invites")}>
          <GuildInvitePanel guildId={guildId} token={token} />
        </Tab>
      </Tabs>
    </div>
  );
}
```

### 6.2 Member List Component

```typescript
// apps/web/src/components/Guild/GuildMemberList.tsx
export function GuildMemberList({ guildId, token }: Props) {
  const { t } = useTranslation("common");
  const [members, setMembers] = useState<GuildMemberWithPlayer[]>([]);
  const [sortBy, setSortBy] = useState<"power" | "role" | "joinedAt">("power");
  
  return (
    <div className="guildMemberList">
      <div className="memberListHeader">
        <span>{t("guild.member.total", { count: members.length })}</span>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="power">{t("guild.sort.power")}</option>
          <option value="role">{t("guild.sort.role")}</option>
          <option value="joinedAt">{t("guild.sort.joinDate")}</option>
        </select>
      </div>
      
      <table className="guildMemberTable">
        <thead>
          <tr>
            <th>{t("guild.member.name")}</th>
            <th>{t("guild.member.class")}</th>
            <th>{t("guild.member.level")}</th>
            <th>{t("guild.member.power")}</th>
            <th>{t("guild.member.role")}</th>
            <th>{t("guild.member.joined")}</th>
            {canKick && <th>{t("guild.member.actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <tr key={member.id}>
              <td>
                <span className={`roleIcon roleIcon-${member.role}`} />
                {member.player.account.username}
              </td>
              <td>{t(`class.${member.player.class}`)}</td>
              <td>{member.player.level}</td>
              <td>{member.contributedPower}</td>
              <td>
                {canPromote ? (
                  <select value={member.role} onChange={() => changeRole(member.id)}>
                    <option value="member">{t("guild.role.member")}</option>
                    <option value="officer">{t("guild.role.officer")}</option>
                  </select>
                ) : (
                  t(`guild.role.${member.role}`)
                )}
              </td>
              <td>{formatDate(member.joinedAt)}</td>
              {canKick && (
                <td>
                  {canKickMember(member) && (
                    <button onClick={() => kickMember(member.id)}>
                      {t("guild.action.kick")}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 6.3 Crest Editor Component

```typescript
// apps/web/src/components/Guild/GuildCrestEditor.tsx
export function GuildCrestEditor({ currentCrest, onSave }: Props) {
  const { t } = useTranslation("common");
  const [crest, setCrest] = useState<GuildCrest>(currentCrest);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  
  useEffect(() => {
    // Re-render preview on change
    const canvas = renderCrest(crest);
    canvas.toBlob((blob) => {
      setPreviewUrl(URL.createObjectURL(blob!));
    });
  }, [crest]);
  
  return (
    <div className="guildCrestEditor">
      <div className="crestPreview">
        <img src={previewUrl} alt={t("guild.crest.preview")} />
      </div>
      
      <div className="crestControls">
        {/* Background Shape */}
        <div className="controlGroup">
          <label>{t("guild.crest.bgShape")}</label>
          <div className="shapeGrid">
            {BG_SHAPES.map(shape => (
              <button
                key={shape}
                className={crest.bgShape === shape ? "active" : ""}
                onClick={() => setCrest({...crest, bgShape: shape})}
              >
                <img src={`/crest-assets/backgrounds/${shape}_thumb.png`} />
              </button>
            ))}
          </div>
        </div>
        
        {/* Background Color */}
        <div className="controlGroup">
          <label>{t("guild.crest.bgColor")}</label>
          <div className="colorGrid">
            {Object.entries(COLOR_PALETTE.backgrounds).map(([name, hex]) => (
              <button
                key={name}
                style={{ backgroundColor: hex }}
                className={crest.bgColor === name ? "active" : ""}
                onClick={() => setCrest({...crest, bgColor: name})}
                title={t(`guild.crest.color.${name}`)}
              />
            ))}
          </div>
        </div>
        
        {/* Foreground Symbol */}
        <div className="controlGroup">
          <label>{t("guild.crest.symbol")}</label>
          <div className="symbolGrid">
            {SYMBOLS.map(symbol => (
              <button
                key={symbol}
                className={crest.fgSymbol === symbol ? "active" : ""}
                onClick={() => setCrest({...crest, fgSymbol: symbol})}
              >
                <img src={`/crest-assets/symbols/${symbol}_thumb.png`} />
              </button>
            ))}
          </div>
        </div>
        
        {/* Similar for fgColor, pattern, frame */}
      </div>
      
      <button onClick={() => onSave(crest)} disabled={!validateCrest(crest)}>
        {t("guild.crest.save")}
      </button>
    </div>
  );
}
```

### 6.4 CSS Styling (Medieval Theme)

```css
/* apps/web/src/styles.css */

.guildOverview {
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.guildHeader {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--panel-elevated);
  border: 1px solid var(--border);
  border-radius: var(--soft-radius);
}

.guildCrest {
  width: 128px;
  height: 128px;
  border: 2px solid var(--accent-focus);
  border-radius: var(--soft-radius);
  background-size: cover;
  flex-shrink: 0;
}

.guildInfo {
  flex: 1;
}

.guildInfo h2 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-display);
  color: var(--accent-focus);
}

.guildStats {
  display: flex;
  gap: var(--space-4);
  font-size: 0.93rem;
  color: var(--text-soft);
}

.guildMemberTable {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel-soft-solid);
}

.guildMemberTable th {
  padding: var(--space-3);
  text-align: left;
  background: var(--bg-slate);
  border-bottom: 1px solid var(--border);
  color: var(--text-soft);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.86rem;
}

.guildMemberTable td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-soft);
}

.roleIcon {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: var(--space-2);
  border-radius: 50%;
}

.roleIcon-leader {
  background: var(--accent-focus);
  box-shadow: 0 0 8px var(--accent-focus);
}

.roleIcon-officer {
  background: var(--accent-warn);
}

.roleIcon-member {
  background: var(--text-muted);
}

.crestPreview {
  width: 256px;
  height: 256px;
  border: 2px solid var(--border);
  border-radius: var(--soft-radius);
  background: var(--bg-slate);
}

.shapeGrid,
.symbolGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: var(--space-2);
}

.colorGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: var(--space-2);
}

.colorGrid button {
  width: 48px;
  height: 48px;
  border: 2px solid var(--border);
  border-radius: var(--soft-radius);
  cursor: pointer;
  transition: all 0.2s;
}

.colorGrid button.active {
  border-color: var(--accent-focus);
  box-shadow: 0 0 12px var(--accent-focus);
}
```

---

## 7. Internationalization

### 7.1 Translation Keys Structure

```json
// apps/web/src/i18n/locales/en/common.json
{
  "guild": {
    "title": "Guild",
    "create": "Create Guild",
    "search": "Find Guild",
    "overview": "Guild Overview",
    "settings": "Guild Settings",
    
    "name": "Guild Name",
    "tag": "Guild Tag",
    "description": "Description",
    "maxMembers": "Maximum Members",
    "totalPower": "Total Power",
    "level": "Guild Level",
    "memberCount": "{{count}} / {{max}} Members",
    
    "tab": {
      "members": "Members",
      "activity": "Activity Log",
      "invites": "Invitations",
      "leaderboard": "Rankings"
    },
    
    "role": {
      "leader": "Leader",
      "officer": "Officer",
      "member": "Member"
    },
    
    "action": {
      "join": "Join Guild",
      "leave": "Leave Guild",
      "kick": "Kick",
      "promote": "Promote",
      "demote": "Demote",
      "invite": "Invite Player",
      "disband": "Disband Guild",
      "transferLeadership": "Transfer Leadership"
    },
    
    "invite": {
      "send": "Send Invitation",
      "accept": "Accept",
      "decline": "Decline",
      "cancel": "Cancel Invitation",
      "pending": "Pending Invitations",
      "received": "Invitations Received",
      "sent": "Invitations Sent",
      "expires": "Expires: {{date}}",
      "expired": "Expired",
      "message": "Personal Message"
    },
    
    "crest": {
      "title": "Guild Crest",
      "edit": "Edit Crest",
      "preview": "Preview",
      "bgShape": "Background Shape",
      "bgColor": "Background Color",
      "bgPattern": "Background Pattern",
      "symbol": "Symbol",
      "symbolColor": "Symbol Color",
      "frame": "Border Frame",
      "save": "Save Crest",
      "color": {
        "crimson": "Crimson",
        "forest": "Forest Green",
        "sapphire": "Sapphire Blue",
        "obsidian": "Obsidian Black",
        "ivory": "Ivory",
        "gold": "Gold",
        "iron": "Iron Gray",
        "silver": "Silver"
      }
    },
    
    "activity": {
      "created": "{{actor}} created the guild",
      "joined": "{{actor}} joined the guild",
      "left": "{{actor}} left the guild",
      "kicked": "{{actor}} kicked {{target}}",
      "promoted": "{{actor}} promoted {{target}} to {{role}}",
      "demoted": "{{actor}} demoted {{target}} to {{role}}",
      "transferredLeadership": "{{actor}} transferred leadership to {{target}}",
      "disbanded": "{{actor}} disbanded the guild",
      "crestChanged": "{{actor}} updated the guild crest",
      "descriptionChanged": "{{actor}} updated the description"
    },
    
    "member": {
      "name": "Name",
      "class": "Class",
      "level": "Level",
      "power": "Power",
      "role": "Role",
      "joined": "Joined",
      "actions": "Actions",
      "total": "{{count}} Members"
    },
    
    "sort": {
      "power": "Sort by Power",
      "role": "Sort by Role",
      "joinDate": "Sort by Join Date"
    },
    
    "error": {
      "nameInvalid": "Guild name must be 3-32 characters, letters and spaces only",
      "tagInvalid": "Guild tag must be 2-6 uppercase letters",
      "nameTaken": "Guild name already taken",
      "tagTaken": "Guild tag already taken",
      "alreadyInGuild": "You are already in a guild",
      "guildFull": "Guild is full",
      "notFound": "Guild not found",
      "insufficientPermissions": "Insufficient permissions",
      "cannotLeaveAsLeader": "Leaders must transfer leadership or disband guild before leaving",
      "rateLimitExceeded": "Too many requests, please wait",
      "inviteExpired": "Invitation has expired",
      "invalidCrest": "Invalid crest configuration"
    },
    
    "confirm": {
      "leave": "Are you sure you want to leave {{guildName}}?",
      "kick": "Are you sure you want to kick {{username}}?",
      "disband": "Are you sure you want to disband the guild? This cannot be undone.",
      "transferLeadership": "Transfer leadership to {{username}}? You will become an officer."
    },
    
    "success": {
      "created": "Guild created successfully",
      "joined": "You joined {{guildName}}",
      "left": "You left the guild",
      "kicked": "{{username}} has been kicked",
      "promoted": "{{username}} promoted to {{role}}",
      "disbanded": "Guild disbanded",
      "inviteSent": "Invitation sent to {{username}}",
      "inviteAccepted": "Invitation accepted",
      "crestUpdated": "Crest updated"
    }
  }
}
```

### 7.2 Locale Files

All 7 locales must receive translations:
- `en/common.json` ✅ (reference above)
- `es-419/common.json` - Spanish
- `pt-BR/common.json` - Portuguese (Brazil)
- `ru/common.json` - Russian
- `zh-CN/common.json` - Chinese (Simplified)
- `fil/common.json` - Filipino
- `ko/common.json` - Korean

**Translation priority:**
1. Critical UI labels (buttons, headers)
2. Error messages
3. Activity log templates
4. Tooltips and help text

---

## 8. Anti-Abuse & Moderation

### 8.1 Rate Limiting

```typescript
// apps/api/src/modules/guild/rate-limiters.ts
import { RateLimiterMemory } from "rate-limiter-flexible";

// Guild creation: 1 per day per account
export const createGuildLimiter = new RateLimiterMemory({
  points: 1,
  duration: 86400,  // 24 hours
  blockDuration: 0
});

// Invite sending: 10 per hour per guild
export const inviteLimiter = new RateLimiterMemory({
  points: 10,
  duration: 3600,
  blockDuration: 0
});

// Guild search: 30 per minute per IP
export const searchLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
  blockDuration: 60
});

// Usage in route
fastify.post("/v1/guild/create", async (request, reply) => {
  try {
    await createGuildLimiter.consume(request.user.accountId);
  } catch (error) {
    return reply.code(429).send({ error: "RATE_LIMIT_EXCEEDED" });
  }
  // ... proceed with guild creation
});
```

### 8.2 Name/Tag Validation

```typescript
// apps/api/src/modules/guild/validation.ts
const PROFANITY_LIST = [
  "badword1", "badword2", // ... expanded list
];

export function validateGuildName(name: string): ValidationResult {
  // Length check
  if (name.length < 3 || name.length > 32) {
    return { valid: false, error: "NAME_LENGTH_INVALID" };
  }
  
  // Character whitelist (letters, spaces, apostrophes)
  if (!/^[a-zA-Z\s']+$/.test(name)) {
    return { valid: false, error: "NAME_CHARACTERS_INVALID" };
  }
  
  // Profanity check
  const lowerName = name.toLowerCase();
  for (const word of PROFANITY_LIST) {
    if (lowerName.includes(word)) {
      return { valid: false, error: "NAME_PROFANITY_DETECTED" };
    }
  }
  
  // Reserved names
  const RESERVED = ["admin", "moderator", "system", "official"];
  if (RESERVED.some(r => lowerName.includes(r))) {
    return { valid: false, error: "NAME_RESERVED" };
  }
  
  return { valid: true };
}

export function validateGuildTag(tag: string): ValidationResult {
  // 2-6 uppercase letters only
  if (!/^[A-Z]{2,6}$/.test(tag)) {
    return { valid: false, error: "TAG_FORMAT_INVALID" };
  }
  
  // Profanity check
  if (PROFANITY_LIST.some(word => tag.includes(word.toUpperCase()))) {
    return { valid: false, error: "TAG_PROFANITY_DETECTED" };
  }
  
  return { valid: true };
}
```

### 8.3 Cooldown Timers

```typescript
// Prevent guild hopping abuse
const LEAVE_COOLDOWN = 86400 * 3; // 3 days

export async function canJoinGuild(
  prisma: PrismaClient,
  playerId: string
): Promise<{ allowed: boolean; cooldownEnds?: Date }> {
  const lastActivity = await prisma.guildActivity.findFirst({
    where: {
      actorId: playerId,
      actionType: { in: ["left", "kicked"] }
    },
    orderBy: { timestamp: "desc" }
  });
  
  if (lastActivity) {
    const cooldownEnd = new Date(lastActivity.timestamp.getTime() + LEAVE_COOLDOWN * 1000);
    if (cooldownEnd > new Date()) {
      return { allowed: false, cooldownEnds: cooldownEnd };
    }
  }
  
  return { allowed: true };
}
```

### 8.4 Audit Logging

```typescript
// All guild actions logged to guild_activity table
export async function logGuildActivity(
  prisma: PrismaClient,
  guildId: string,
  actionType: string,
  actorId: string | null,
  targetId: string | null,
  metadata?: object
): Promise<void> {
  await prisma.guildActivity.create({
    data: {
      guildId,
      actorId,
      actionType,
      targetId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      timestamp: new Date()
    }
  });
}

// Retention policy: keep 90 days, archive older
// Cron job: DELETE FROM guild_activity WHERE timestamp < NOW() - INTERVAL '90 days'
```

### 8.5 Leader Abandonment Protection

```typescript
// Auto-demote inactive leaders (30+ days offline)
async function checkInactiveLeaders() {
  const inactiveLeaders = await prisma.guildMember.findMany({
    where: {
      role: "leader",
      player: {
        updatedAt: { lt: new Date(Date.now() - 30 * 86400 * 1000) }
      }
    },
    include: {
      guild: {
        include: {
          members: {
            where: { role: "officer" },
            orderBy: { contributedPower: "desc" },
            take: 1
          }
        }
      }
    }
  });
  
  for (const leader of inactiveLeaders) {
    const topOfficer = leader.guild.members[0];
    if (topOfficer) {
      // Transfer to top officer
      await transferLeadership(leader.guildId, topOfficer.playerId, true);
      await logGuildActivity(
        prisma,
        leader.guildId,
        "leadership_transferred_auto",
        null,
        topOfficer.playerId,
        { reason: "leader_inactive_30d" }
      );
    } else {
      // No officers, disband guild
      await disbandGuild(leader.guildId, true);
    }
  }
}
```

---

## 9. Performance Optimization

### 9.1 Database Query Optimization

```typescript
// Bad: N+1 query
const members = await prisma.guildMember.findMany({ where: { guildId } });
for (const member of members) {
  const player = await prisma.playerProfile.findUnique({ where: { id: member.playerId }});
}

// Good: Single query with include
const members = await prisma.guildMember.findMany({
  where: { guildId },
  include: {
    player: {
      select: {
        id: true,
        class: true,
        level: true,
        gearScore: true,
        account: {
          select: { username: true }
        }
      }
    }
  }
});
```

### 9.2 Caching Strategy

```typescript
// Redis cache for frequently accessed guilds
import { Redis } from "ioredis";

const GUILD_CACHE_TTL = 300; // 5 minutes

export async function getGuildCached(
  redis: Redis,
  prisma: PrismaClient,
  guildId: string
): Promise<Guild | null> {
  const cacheKey = `guild:${guildId}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from DB
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (guild) {
    await redis.setex(cacheKey, GUILD_CACHE_TTL, JSON.stringify(guild));
  }
  
  return guild;
}

// Invalidate cache on update
export async function updateGuildInvalidateCache(
  redis: Redis,
  prisma: PrismaClient,
  guildId: string,
  data: Partial<Guild>
): Promise<Guild> {
  const guild = await prisma.guild.update({
    where: { id: guildId },
    data
  });
  
  await redis.del(`guild:${guildId}`);
  return guild;
}
```

### 9.3 Pagination & Lazy Loading

```typescript
// Member list pagination
GET /v1/guild/:guildId/members?limit=50&offset=0

// Activity log cursor pagination
GET /v1/guild/:guildId/activity?limit=20&cursor=<lastActivityId>

// Frontend: Infinite scroll
function useGuildActivity(guildId: string) {
  const [activities, setActivities] = useState<GuildActivity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMore = async () => {
    const response = await fetchGuildActivity(guildId, cursor);
    setActivities(prev => [...prev, ...response.activities]);
    setCursor(response.nextCursor);
    setHasMore(response.hasMore);
  };
  
  return { activities, loadMore, hasMore };
}
```

### 9.4 Crest Rendering Optimization

```typescript
// Preload common crest assets on app boot
const CRITICAL_ASSETS = [
  "/crest-assets/backgrounds/shield_01.png",
  "/crest-assets/symbols/sword_01.png",
  "/crest-assets/symbols/dragon_01.png",
  // ... top 20 most used
];

export function preloadCrestAssets() {
  CRITICAL_ASSETS.forEach(url => {
    const img = new Image();
    img.src = url;
  });
}

// Render crests in Web Worker to avoid blocking main thread
const crestWorker = new Worker("/workers/crest-renderer.js");

export function renderCrestAsync(crest: GuildCrest): Promise<Blob> {
  return new Promise((resolve) => {
    crestWorker.postMessage({ crest });
    crestWorker.onmessage = (e) => resolve(e.data.blob);
  });
}
```

---

## 10. Optional Improvements (Future Phases)

### Phase 2 Enhancements

1. **Guild Bank**
   - Shared storage for items/resources
   - Withdrawal permissions by role
   - Contribution tracking

2. **Guild Leveling**
   - XP from member activities (contracts, auctions, combat)
   - Unlock perks: +max members, special crest frames
   - Prestige system

3. **Guild Alliances**
   - Diplomat role
   - Alliance chat channel
   - Joint leaderboard category

4. **Guild Wars** (PvP Focus)
   - Territory control
   - Guild vs. Guild combat instances
   - Seasonal rankings

5. **Guild Quests**
   - Cooperative PvE objectives
   - Reward entire guild on completion
   - Weekly/monthly rotations

### Advanced Crest Features

1. **Animated Crests**
   - Glow effects for top-ranked guilds
   - Subtle particle effects (embers, snowflakes)
   - Unlocked via achievements

2. **3D Crest Display**
   - Three.js rendering for depth
   - Rotate/zoom preview
   - Export as profile badge

3. **Crest History**
   - Archive past crest designs
   - "Revert to previous" option
   - Gallery view

---

## 11. Implementation Roadmap

### Week 1: Backend Foundation
- **Day 1-2:** Database schema + migration
- **Day 3-4:** Core API routes (create, join, leave, disband)
- **Day 5:** Permission system + validation

### Week 2: Invite & Management
- **Day 1-2:** Invite system (send/accept/decline)
- **Day 3:** Member management (kick, promote, demote)
- **Day 4:** Activity logging
- **Day 5:** Rate limiting + anti-abuse

### Week 3: Frontend UI
- **Day 1:** Guild overview component
- **Day 2:** Member list + activity log
- **Day 3:** Invite panel
- **Day 4:** Guild settings panel
- **Day 5:** Responsive styling

### Week 4: Crest System & Polish
- **Day 1-2:** Crest asset pool preparation
- **Day 3:** Crest editor component
- **Day 4:** Crest rendering + caching
- **Day 5:** Translation, testing, bug fixes

### Week 5: Integration & Testing
- **Day 1:** Integrate with leaderboards
- **Day 2:** Display guild tags in player profiles
- **Day 3:** Load testing (1000+ guilds, 10k+ members)
- **Day 4:** Security audit
- **Day 5:** Documentation + deployment

---

## 12. Success Metrics

### KPIs to Track

1. **Adoption Rate**
   - % of active players in guilds
   - Target: 60% within 30 days

2. **Guild Retention**
   - % of guilds active after 30 days
   - Target: 75%

3. **Engagement Metrics**
   - Average guild size: 15-25 members
   - Daily active guild members: 70%+

4. **Technical Performance**
   - API response time: <200ms (p95)
   - Crest render time: <100ms
   - Cache hit rate: >85%

5. **Moderation**
   - Profanity filter accuracy: >95%
   - Reported guilds resolved: <24h

---

## 13. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database migration failure | High | Staged rollout, backup/rollback plan |
| Guild name abuse | Medium | Profanity filter + manual review queue |
| Crest rendering performance | Medium | Client-side caching + pre-rendered CDN |
| Leader abandonment | Low | Auto-transfer after 30d inactivity |
| Invite spam | Medium | Rate limiting (10/hour) |
| Large guild queries slow | Medium | Pagination + Redis caching |

---

## Appendix A: Crest Asset Generation Prompts

### Background Shapes

```
Prompt: "Medieval heraldic shield icon, simple geometric shape #1, 
flat solid color fill, clean vector-like edges, 256x256px, 
transparent background, game UI asset style, hand-painted fantasy RPG, 
parchment texture, suitable for color tinting"

Variations: 5 shield shapes
Output: shield_01.png, shield_02.png, ...
```

### Symbols - Weapons

```
Prompt: "Medieval longsword icon silhouette, bold clean edges, 
centered composition, single layer for emblem use, 
fantasy game heraldic crest symbol, 256x256px transparent, 
sharp blade and crossguard details, suitable for color fill"

Prompt: "Battle axe icon silhouette, double-bladed war axe, 
medieval fantasy weapon emblem, bold lines, heraldic style, 
256x256px transparent, centered, game UI asset"
```

### Symbols - Creatures

```
Prompt: "Stylized dragon head profile silhouette, medieval heraldic emblem, 
fierce expression, clean edges for guild crest icon, 
fantasy RPG game asset, 256x256px transparent, 
bold shapes, suitable for color tinting"

Prompt: "Wolf head howling icon, medieval heraldic style, 
bold silhouette for guild emblem, fantasy game UI asset, 
256x256px transparent, clean edges"
```

### Frames

```
Prompt: "Ornate medieval border frame, decorative gothic flourishes, 
empty center for emblem, 256x256px transparent, 
gold embossing style, fantasy game UI asset, 
corner details, symmetrical design"
```

---

## Appendix B: Example API Flow

### Creating a Guild

```typescript
// 1. Frontend: Player fills form
const guildData = {
  name: "Knights of Ebonkeep",
  tag: "KOE",
  description: "Elite warriors seeking glory",
  crestConfig: {
    bgShape: "shield_01",
    bgColor: "crimson",
    fgSymbol: "sword_01",
    fgColor: "gold",
    frame: "ornate_01"
  }
};

// 2. API call
const response = await fetch("/v1/guild/create", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify(guildData)
});

// 3. Backend: Validate, create, return
const guild = await prisma.guild.create({
  data: {
    ...guildData,
    leaderId: currentPlayer.id,
    crestBgShape: guildData.crestConfig.bgShape,
    crestBgColor: guildData.crestConfig.bgColor,
    crestFgSymbol: guildData.crestConfig.fgSymbol,
    crestFgColor: guildData.crestConfig.fgColor,
    crestFrame: guildData.crestConfig.frame
  }
});

// 4. Create leader membership
const membership = await prisma.guildMember.create({
  data: {
    guildId: guild.id,
    playerId: currentPlayer.id,
    role: "leader",
    contributedPower: currentPlayer.gearScore
  }
});

// 5. Log activity
await logGuildActivity(prisma, guild.id, "created", currentPlayer.id, null);

// 6. Return to frontend
return { guild, membership };
```

---

## Summary

This design provides a **production-ready guild system** with:

✅ **Scalable database schema** (6 tables, proper indexes)  
✅ **15+ RESTful API endpoints** with authentication & rate limiting  
✅ **Role-based permission system** (leader, officer, member)  
✅ **Composable crest generator** (40,000+ combinations, no user uploads)  
✅ **Medieval-themed UI** with responsive design  
✅ **Multi-language support** (7 locales)  
✅ **Anti-abuse protections** (profanity filters, cooldowns, rate limits)  
✅ **Performance optimizations** (caching, pagination, pre-rendering)  
✅ **Clear implementation roadmap** (4-5 weeks)

**Next Step:** Review, refine, and begin implementation starting with database migration and core API routes.
