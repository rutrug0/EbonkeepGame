import { useState, useEffect, useEffectEvent, useRef, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { PlayerClass } from "@ebonkeep/shared/core";
import { classesByStatTree, type PlayerStatTree } from "@ebonkeep/shared/core";

import { PORTRAIT_POOL_BY_TREE, getDefaultPortraitId, BACKGROUND_POOL, getBackgroundPath } from "../constants/portraits";
import type { LayoutMode } from "./navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthScreenProps = {
  layoutMode: LayoutMode;
  // reset-password flow
  resetToken: string | null;
  newPassword: string;
  confirmPassword: string;
  resetPasswordMessage: string | null;
  // auth mode
  authMode: "login" | "register";
  authUsername: string;
  authEmail: string;
  authPassword: string;
  authRepeatPassword: string;
  showPassword: boolean;
  showRepeatPassword: boolean;
  authClass: PlayerClass;
  authPortraitId: string;
  authBackgroundId: string;
  // forgot-password
  showForgotPassword: boolean;
  forgotPasswordEmail: string;
  forgotPasswordMessage: string | null;
  error: string | null;
  // callbacks
  onResetPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onAuthModeChange: (mode: "login" | "register") => void;
  onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRegisterSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAuthUsernameChange: (value: string) => void;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onAuthRepeatPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onToggleShowRepeatPassword: () => void;
  onShowForgotPassword: () => void;
  onForgotPasswordClose: () => void;
  onAuthClassChange: (value: PlayerClass) => void;
  onAuthPortraitChange: (value: string) => void;
  onAuthBackgroundChange: (value: string) => void;
  onGuestLogin: () => void;
  onForgotPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onForgotPasswordEmailChange: (value: string) => void;
  onCheckCredentials?: () => Promise<boolean>;
};

const AUTH_INTRO_SESSION_KEY = "ebonkeep.authIntroSeen";
const AUTH_INTRO_VIDEO_PATH = "/assets/video/ebonkeep_video.mp4";
const AUTH_LOADER_REVEAL_DELAY_MS = 140;
const AUTH_INTRO_TIMEOUT_MS = 4500;
const AUTH_REDUCED_MOTION_TIMEOUT_MS = 180;
const AUTH_VIDEO_FADE_MS = 900;

type AuthIntroPhase = "boot" | "video-visible" | "form-visible";

function hasSeenAuthIntro(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(AUTH_INTRO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function readReducedMotionPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(readReducedMotionPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreference);
      return () => mediaQuery.removeEventListener("change", syncPreference);
    }

    mediaQuery.addListener(syncPreference);
    return () => mediaQuery.removeListener(syncPreference);
  }, []);

  return prefersReducedMotion;
}

// ─── Stat-tree metadata ────────────────────────────────────────────────────────

const STAT_TREES: Array<{
  id: PlayerStatTree;
  labelKey: string;
  descriptionKey: string;
  accentColor: string;
  borderColor: string;
  bgColor: string;
}> = [
  {
    id: "strength",
    labelKey: "register.treeStrength",
    descriptionKey: "register.treeStrengthDesc",
    accentColor: "#c9763a",
    borderColor: "rgba(201,118,58,0.55)",
    bgColor: "rgba(201,118,58,0.08)"
  },
  {
    id: "dexterity",
    labelKey: "register.treeDexterity",
    descriptionKey: "register.treeDexterityDesc",
    accentColor: "#6f9e56",
    borderColor: "rgba(111,158,86,0.55)",
    bgColor: "rgba(111,158,86,0.08)"
  },
  {
    id: "intelligence",
    labelKey: "register.treeIntelligence",
    descriptionKey: "register.treeIntelligenceDesc",
    accentColor: "#4c868d",
    borderColor: "rgba(76,134,141,0.55)",
    bgColor: "rgba(76,134,141,0.08)"
  }
];

// ─── Class metadata ────────────────────────────────────────────────────────────

type ClassMeta = {
  id: PlayerClass;
  labelKey: string;
  weaponKey: string;
  countersKey: string;
};

const CLASS_META: Record<PlayerClass, ClassMeta> = {
  juggernaut:   { id: "juggernaut",   labelKey: "class.juggernaut",   weaponKey: "register.weaponMaul",        countersKey: "register.countersStr" },
  sentinel:     { id: "sentinel",     labelKey: "class.sentinel",     weaponKey: "register.weaponSpear",       countersKey: "register.countersDex" },
  reaver:       { id: "reaver",       labelKey: "class.reaver",       weaponKey: "register.weaponCleaver",     countersKey: "register.countersInt" },
  shade:        { id: "shade",        labelKey: "class.shade",        weaponKey: "register.weaponTwinDaggers", countersKey: "register.countersInt" },
  arbalist:     { id: "arbalist",     labelKey: "class.arbalist",     weaponKey: "register.weaponCrossbow",    countersKey: "register.countersStr" },
  disciple:     { id: "disciple",     labelKey: "class.disciple",     weaponKey: "register.weaponChakrams",    countersKey: "register.countersDex" },
  runecaster:   { id: "runecaster",   labelKey: "class.runecaster",   weaponKey: "register.weaponRuneStone",   countersKey: "register.countersStr" },
  voidcaster:   { id: "voidcaster",   labelKey: "class.voidcaster",   weaponKey: "register.weaponVoidGlaive", countersKey: "register.countersDex" },
  arcanist:     { id: "arcanist",     labelKey: "class.arcanist",     weaponKey: "register.weaponGrimoire",    countersKey: "register.countersInt" }
};

// ─── Sub-components ────────────────────────────────────────────────────────────

type StepIndicatorProps = { step: number; total: number };
function StepIndicator({ step, total }: StepIndicatorProps) {
  const { t } = useTranslation("common");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? "24px" : "8px",
            height: "8px",
            borderRadius: "99px",
            background: i === step ? "var(--accent-focus)" : "var(--border)",
            transition: "all 200ms ease"
          }}
        />
      ))}
      <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>
        {t("register.stepOf", { step: step + 1, total })}
      </span>
    </div>
  );
}

// ─── Step 1 — account credentials ─────────────────────────────────────────────

type Step1Props = {
  username: string;
  email: string;
  password: string;
  repeatPassword: string;
  showPassword: boolean;
  showRepeatPassword: boolean;
  error: string | null;
  onUsernameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onRepeatPasswordChange: (v: string) => void;
  onTogglePassword: () => void;
  onToggleRepeatPassword: () => void;
  onNext: () => void | Promise<void>;
};

function CredentialsStep({
  username, email, password, repeatPassword,
  showPassword, showRepeatPassword, error,
  onUsernameChange, onEmailChange, onPasswordChange, onRepeatPasswordChange,
  onTogglePassword, onToggleRepeatPassword, onNext
}: Step1Props) {
  const { t } = useTranslation("common");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void onNext();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <label className="authLabel">{t("register.username")}</label>
        <input
          className="authInput"
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder={t("register.usernamePlaceholder")}
          required
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9_]+"
          title={t("register.usernameHint")}
          autoComplete="username"
        />
      </div>
      <div>
        <label className="authLabel">{t("register.email")}</label>
        <input
          className="authInput"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={t("register.emailPlaceholder")}
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="authLabel">{t("register.password")}</label>
        <div style={{ position: "relative" }}>
          <input
            className="authInput"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t("register.passwordPlaceholder")}
            required
            minLength={8}
            style={{ paddingRight: "44px", width: "100%", boxSizing: "border-box" }}
            autoComplete="new-password"
          />
          <button type="button" onClick={onTogglePassword} style={eyeButtonStyle}>
            {showPassword ? "👁️" : "👁️‍🗨️"}
          </button>
        </div>
      </div>
      <div>
        <label className="authLabel">{t("register.repeatPassword")}</label>
        <div style={{ position: "relative" }}>
          <input
            className="authInput"
            type={showRepeatPassword ? "text" : "password"}
            value={repeatPassword}
            onChange={(e) => onRepeatPasswordChange(e.target.value)}
            placeholder={t("register.repeatPasswordPlaceholder")}
            required
            minLength={8}
            style={{ paddingRight: "44px", width: "100%", boxSizing: "border-box" }}
            autoComplete="new-password"
          />
          <button type="button" onClick={onToggleRepeatPassword} style={eyeButtonStyle}>
            {showRepeatPassword ? "👁️" : "👁️‍🗨️"}
          </button>
        </div>
      </div>
      {error ? <div className="authError">{error}</div> : null}
      <button type="submit" className="btn btn-primary authSubmit">
        {t("register.next")}
      </button>
    </form>
  );
}

// ─── Step 2 — stat tree selection ─────────────────────────────────────────────

type Step2Props = {
  selectedTree: PlayerStatTree;
  onSelectTree: (tree: PlayerStatTree) => void;
  onNext: () => void;
  onBack: () => void;
};

function StatTreeStep({ selectedTree, onSelectTree, onNext, onBack }: Step2Props) {
  const { t } = useTranslation("common");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "14px", textAlign: "center" }}>
        {t("register.pickTreeHint")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {STAT_TREES.map((tree) => {
          const selected = tree.id === selectedTree;
          return (
            <button
              key={tree.id}
              type="button"
              onClick={() => onSelectTree(tree.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "4px",
                padding: "14px 16px",
                borderRadius: "var(--soft-radius)",
                border: `2px solid ${selected ? tree.borderColor : "var(--border-soft)"}`,
                background: selected ? tree.bgColor : "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 160ms ease"
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "15px", color: selected ? tree.accentColor : "var(--text-main)" }}>
                {t(tree.labelKey)}
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                {t(tree.descriptionKey)}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="button" className="btn btn-secondary authBack" onClick={onBack}>
          {t("register.back")}
        </button>
        <button type="button" className="btn btn-primary authSubmit" onClick={onNext} style={{ flex: 1 }}>
          {t("register.next")}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — class selection ──────────────────────────────────────────────────

type Step3Props = {
  statTree: PlayerStatTree;
  selectedClass: PlayerClass;
  onSelectClass: (cls: PlayerClass) => void;
  onNext: () => void;
  onBack: () => void;
};

function ClassStep({ statTree, selectedClass, onSelectClass, onNext, onBack }: Step3Props) {
  const { t } = useTranslation("common");
  const treeMeta = STAT_TREES.find((tr) => tr.id === statTree)!;
  const classes = classesByStatTree[statTree];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "14px", textAlign: "center" }}>
        {t("register.pickClassHint")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {classes.map((cls) => {
          const meta = CLASS_META[cls];
          const selected = cls === selectedClass;
          return (
            <button
              key={cls}
              type="button"
              onClick={() => onSelectClass(cls)}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: "8px",
                padding: "12px 14px",
                borderRadius: "var(--soft-radius)",
                border: `2px solid ${selected ? treeMeta.borderColor : "var(--border-soft)"}`,
                background: selected ? treeMeta.bgColor : "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 160ms ease"
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "15px", color: selected ? treeMeta.accentColor : "var(--text-main)" }}>
                  {t(meta.labelKey)}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {t(meta.weaponKey)}
                </div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: "4px",
                  padding: "3px 7px",
                  whiteSpace: "nowrap"
                }}
              >
                {t("register.counters")} {t(meta.countersKey)}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="button" className="btn btn-secondary authBack" onClick={onBack}>
          {t("register.back")}
        </button>
        <button type="button" className="btn btn-primary authSubmit" onClick={onNext} style={{ flex: 1 }}>
          {t("register.next")}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — portrait + background selection ────────────────────────────────

type Step4Props = {
  selectedPortraitId: string;
  onSelectPortrait: (id: string) => void;
  selectedBackgroundId: string;
  onSelectBackground: (id: string) => void;
  statTree: PlayerStatTree;
  selectedClass: PlayerClass;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  error: string | null;
};

const sectionLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: "7px",
};

function PortraitStep({ selectedPortraitId, onSelectPortrait, selectedBackgroundId, onSelectBackground, statTree, selectedClass, onSubmit, onBack, error }: Step4Props) {
  const { t } = useTranslation("common");
  const meta = CLASS_META[selectedClass];
  const portraits = PORTRAIT_POOL_BY_TREE[statTree];
  const currentBgPath = getBackgroundPath(selectedBackgroundId);
  const selectedPortraitPath = portraits.find((p) => p.id === selectedPortraitId)?.path ?? portraits[0]?.path ?? "";

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>

      {/* ── LEFT: selectors ──────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Background picker */}
        <div>
          <span style={sectionLabelStyle}>{t("register.chooseBackground")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
            {BACKGROUND_POOL.map((bg) => {
              const isSelected = bg.id === selectedBackgroundId;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => onSelectBackground(bg.id)}
                  style={{
                    padding: 0,
                    aspectRatio: "4 / 3",
                    border: `2px solid ${isSelected ? "var(--accent-focus)" : "var(--border-soft)"}`,
                    borderRadius: "calc(var(--soft-radius) - 1px)",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "rgba(0,0,0,0.4)",
                    transition: "border-color 140ms ease, transform 120ms ease",
                    transform: isSelected ? "scale(1.04)" : "scale(1)",
                    position: "relative",
                  }}
                >
                  <img
                    src={bg.path}
                    alt={bg.id}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
                  />
                  {isSelected && (
                    <div style={{
                      position: "absolute", inset: 0,
                      border: "2px solid var(--accent-focus)",
                      borderRadius: "calc(var(--soft-radius) - 1px)",
                      pointerEvents: "none",
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Portrait picker */}
        <div>
          <span style={sectionLabelStyle}>{t("register.choosePortrait")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
            {portraits.map((portrait) => {
              const isSelected = portrait.id === selectedPortraitId;
              return (
                <button
                  key={portrait.id}
                  type="button"
                  onClick={() => onSelectPortrait(portrait.id)}
                  style={{
                    padding: 0,
                    borderRadius: "calc(var(--soft-radius) - 1px)",
                    border: `2px solid ${isSelected ? "var(--accent-focus)" : "var(--border-soft)"}`,
                    cursor: "pointer",
                    aspectRatio: "2 / 3",
                    overflow: "hidden",
                    position: "relative",
                    transition: "border-color 140ms ease, transform 120ms ease, box-shadow 140ms ease",
                    transform: isSelected ? "scale(1.04)" : "scale(1)",
                    boxShadow: isSelected ? "0 0 10px 1px color-mix(in srgb, var(--accent-focus) 45%, transparent)" : "none",
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  <img
                    src={currentBgPath}
                    alt=""
                    aria-hidden="true"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <img
                    src={portrait.path}
                    alt={portrait.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "top center",
                      display: "block",
                    }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  {isSelected && (
                    <div style={{
                      position: "absolute",
                      top: "4px", right: "4px",
                      width: "14px", height: "14px",
                      borderRadius: "999px",
                      background: "var(--accent-focus)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "9px", color: "#000", fontWeight: 900,
                      pointerEvents: "none",
                      lineHeight: 1,
                    }}>✓</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Class badge */}
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--soft-radius)",
            border: "1px solid var(--border-soft)",
            background: "rgba(0,0,0,0.2)",
            fontSize: "13px",
            color: "var(--text-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
          }}
        >
          <span>{t("register.yourClass")}</span>
          <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{t(meta.labelKey)}</span>
        </div>
      </div>

      {/* ── RIGHT: preview + actions ───────────────────── */}
      <div style={{ width: "280px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Preview frame */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "9 / 10",
            borderRadius: "var(--soft-radius)",
            border: "1px solid rgba(183, 166, 136, 0.2)",
            background: "rgba(18, 24, 30, 0.85)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Background */}
          <img
            src={currentBgPath}
            alt=""
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", zIndex: 1 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          {/* Portrait on top */}
          <img
            src={selectedPortraitPath}
            alt={selectedPortraitId}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top center",
              display: "block",
              zIndex: 2,
              pointerEvents: "none",
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          {/* Class label at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "18px 10px 8px",
              background: "linear-gradient(to top, rgba(8,10,16,0.85) 0%, transparent 100%)",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-soft)",
              textAlign: "center",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              zIndex: 3,
            }}
          >
            {t(meta.labelKey)}
          </div>
        </div>

        {error ? <div className="authError" style={{ fontSize: "12px" }}>{error}</div> : null}

        {/* Action buttons — pinned at bottom */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
            {t("register.createAccount")}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: "100%" }} onClick={onBack}>
            {t("register.back")}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Shared inline styles ──────────────────────────────────────────────────────

const eyeButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "18px",
  padding: "4px",
  color: "var(--text-muted)"
};

// ─── Main AuthScreen ───────────────────────────────────────────────────────────

export function AuthScreen(props: AuthScreenProps) {
  const { t } = useTranslation("common");
  const prefersReducedMotion = usePrefersReducedMotion();

  const [registerStep, setRegisterStep] = useState<number>(0);
  const [hasSeenIntroThisSession, setHasSeenIntroThisSession] = useState<boolean>(hasSeenAuthIntro);
  const [introPhase, setIntroPhase] = useState<AuthIntroPhase>("boot");
  const [isLoaderVisible, setIsLoaderVisible] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedTree, setSelectedTree] = useState<PlayerStatTree>(() =>
    classesByStatTree.strength.includes(props.authClass)
      ? "strength"
      : classesByStatTree.dexterity.includes(props.authClass)
      ? "dexterity"
      : "intelligence"
  );

  function handleTreeSelect(tree: PlayerStatTree) {
    setSelectedTree(tree);
    props.onAuthClassChange(classesByStatTree[tree][0]);
    props.onAuthPortraitChange(getDefaultPortraitId(tree));
  }

  async function handleStep1Next() {
    if (!props.authUsername || !props.authEmail || !props.authPassword || !props.authRepeatPassword) return;
    if (props.authPassword !== props.authRepeatPassword) return;
    if (props.onCheckCredentials) {
      const ok = await props.onCheckCredentials();
      if (!ok) return;
    }
    setRegisterStep(1);
  }

  const completeIntro = useEffectEvent(() => {
    setIntroPhase("form-visible");
    setHasSeenIntroThisSession(true);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(AUTH_INTRO_SESSION_KEY, "1");
      } catch {
        // Ignore session storage failures and continue.
      }
    }
  });

  const revealVideo = useEffectEvent(() => {
    setIntroPhase((currentPhase) => (currentPhase === "boot" ? "video-visible" : currentPhase));
  });

  const handleVideoReady = useEffectEvent(() => {
    if (videoFailed) {
      return;
    }

    if (hasSeenIntroThisSession || prefersReducedMotion) {
      completeIntro();
      return;
    }

    revealVideo();
  });

  const handleVideoError = useEffectEvent(() => {
    setVideoFailed(true);
    completeIntro();
  });

  useEffect(() => {
    if (!props.error) return;
    const lower = props.error.toLowerCase();
    if ((lower.includes("email") || lower.includes("username")) && registerStep > 0) {
      setRegisterStep(0);
    }
  }, [props.error, registerStep]);

  useEffect(() => {
    if (introPhase !== "boot") {
      setIsLoaderVisible(false);
      return;
    }

    setIsLoaderVisible(false);

    if (prefersReducedMotion) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoaderVisible(true);
    }, AUTH_LOADER_REVEAL_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [introPhase, prefersReducedMotion]);

  useEffect(() => {
    if (introPhase !== "boot") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVideoFailed(true);
      completeIntro();
    }, prefersReducedMotion ? AUTH_REDUCED_MOTION_TIMEOUT_MS : AUTH_INTRO_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [completeIntro, introPhase, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || introPhase !== "boot" || videoFailed) {
      return;
    }

    const videoElement = introVideoRef.current;
    const readyThreshold = typeof HTMLMediaElement !== "undefined" ? HTMLMediaElement.HAVE_CURRENT_DATA : 2;
    if (videoElement && videoElement.readyState >= readyThreshold) {
      handleVideoReady();
    }
  }, [handleVideoReady, introPhase, videoFailed]);

  useEffect(() => {
    if (introPhase !== "video-visible") {
      return;
    }

    if (prefersReducedMotion) {
      completeIntro();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      completeIntro();
    }, AUTH_VIDEO_FADE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [completeIntro, introPhase, prefersReducedMotion]);

  const shouldRenderVideo = !prefersReducedMotion && !videoFailed;
  const introLoaderState = introPhase === "boot" && isLoaderVisible ? "visible" : "hidden";
  const introContentState = introPhase === "form-visible" ? "visible" : "hidden";
  const introVideoState = !shouldRenderVideo ? "hidden" : introPhase === "boot" ? "hidden" : "visible";

  return (
    <main className={`appRoot layout-${props.layoutMode}`}>
      <div className="appSurface">
        <section className="authPage" data-intro-phase={introPhase}>
          <div
            className={`authIntroBackground${introVideoState === "visible" ? " is-visible" : ""}`}
            data-state={introVideoState}
            aria-hidden="true"
          >
            {shouldRenderVideo ? (
              <video
                ref={introVideoRef}
                data-testid="auth-intro-video"
                className="authIntroVideo"
                src={AUTH_INTRO_VIDEO_PATH}
                muted
                autoPlay
                playsInline
                loop
                preload="auto"
                onLoadedData={handleVideoReady}
                onCanPlay={handleVideoReady}
                onError={handleVideoError}
              />
            ) : null}
            <div className="authIntroVideoScrim" />
          </div>

          <div
            className={`authIntroLoader${introLoaderState === "visible" ? " is-visible" : ""}`}
            data-testid="auth-intro-loader"
            data-state={introLoaderState}
            aria-hidden={introLoaderState !== "visible"}
          >
            <div className="authHourglass" />
          </div>

          <div
            className={`authContentLayer${introContentState === "visible" ? " is-visible" : ""}`}
            data-testid="auth-content"
            data-state={introContentState}
          >
            <section className="authCard" style={{ width: props.authMode === "register" && registerStep === 3 ? "min(800px, calc(100vw - 32px))" : "min(520px, 100%)", transition: "width 220ms ease" }}>
              <h1 style={{ margin: 0, textAlign: "center" }}>{t("app.title")}</h1>

              {props.resetToken ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <h2 style={{ margin: 0 }}>{t("auth.resetYourPassword")}</h2>
                  <form
                    onSubmit={props.onResetPasswordSubmit}
                    style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                  >
                    <input
                      className="authInput"
                      type="password"
                      placeholder={t("register.newPassword")}
                      value={props.newPassword}
                      onChange={(e) => props.onNewPasswordChange(e.target.value)}
                      required
                      minLength={8}
                    />
                    <input
                      className="authInput"
                      type="password"
                      placeholder={t("register.confirmNewPassword")}
                      value={props.confirmPassword}
                      onChange={(e) => props.onConfirmPasswordChange(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button type="submit" className="btn btn-primary authSubmit">
                      {t("auth.resetPassword")}
                    </button>
                  </form>
                  {props.resetPasswordMessage ? (
                    <div className={props.resetPasswordMessage.toLowerCase().includes("success") ? "authSuccess" : "authError"}>
                      {props.resetPasswordMessage}
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div style={tabsStyle}>
                    <button
                      type="button"
                      onClick={() => { props.onAuthModeChange("login"); setRegisterStep(0); }}
                      style={tabStyle(props.authMode === "login")}
                    >
                      {t("auth.login")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { props.onAuthModeChange("register"); setRegisterStep(0); }}
                      style={tabStyle(props.authMode === "register")}
                    >
                      {t("auth.register")}
                    </button>
                  </div>

                  {props.authMode === "login" ? (
                    <form
                      onSubmit={props.onLoginSubmit}
                      style={{ display: "flex", flexDirection: "column", gap: "14px" }}
                    >
                    <div>
                      <label className="authLabel">{t("register.email")}</label>
                      <input
                        className="authInput"
                        type="email"
                        value={props.authEmail}
                        onChange={(e) => props.onAuthEmailChange(e.target.value)}
                        placeholder={t("register.emailPlaceholder")}
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label className="authLabel" style={{ margin: 0 }}>{t("register.password")}</label>
                        <button type="button" onClick={props.onShowForgotPassword} style={forgotLinkStyle}>
                          {t("auth.forgotPassword")}
                        </button>
                      </div>
                      <div style={{ position: "relative", marginTop: "4px" }}>
                        <input
                          className="authInput"
                          type={props.showPassword ? "text" : "password"}
                          value={props.authPassword}
                          onChange={(e) => props.onAuthPasswordChange(e.target.value)}
                          placeholder={t("register.passwordPlaceholder")}
                          required
                          style={{ paddingRight: "44px", width: "100%", boxSizing: "border-box" }}
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={props.onToggleShowPassword} style={eyeButtonStyle}>
                          {props.showPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                    </div>

                    {props.error ? <div className="authError">{t("app.errorPrefix")}: {props.error}</div> : null}

                    <button type="submit" className="btn btn-primary authSubmit">
                      {t("auth.login")}
                    </button>

                    <div style={dividerStyle}>
                      <button
                        data-testid="guest-login-button"
                        type="button"
                        onClick={props.onGuestLogin}
                        className="btn btn-secondary"
                        style={{ width: "100%" }}
                      >
                        {t("auth.loginGuest")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <StepIndicator step={registerStep} total={4} />

                    {registerStep === 0 && (
                      <>
                        <h3 style={stepTitleStyle}>{t("register.stepAccount")}</h3>
                        <CredentialsStep
                          username={props.authUsername}
                          email={props.authEmail}
                          password={props.authPassword}
                          repeatPassword={props.authRepeatPassword}
                          showPassword={props.showPassword}
                          showRepeatPassword={props.showRepeatPassword}
                          error={props.error}
                          onUsernameChange={props.onAuthUsernameChange}
                          onEmailChange={props.onAuthEmailChange}
                          onPasswordChange={props.onAuthPasswordChange}
                          onRepeatPasswordChange={props.onAuthRepeatPasswordChange}
                          onTogglePassword={props.onToggleShowPassword}
                          onToggleRepeatPassword={props.onToggleShowRepeatPassword}
                          onNext={handleStep1Next}
                        />
                      </>
                    )}

                    {registerStep === 1 && (
                      <>
                        <h3 style={stepTitleStyle}>{t("register.stepStatTree")}</h3>
                        <StatTreeStep
                          selectedTree={selectedTree}
                          onSelectTree={handleTreeSelect}
                          onNext={() => setRegisterStep(2)}
                          onBack={() => setRegisterStep(0)}
                        />
                      </>
                    )}

                    {registerStep === 2 && (
                      <>
                        <h3 style={stepTitleStyle}>{t("register.stepClass")}</h3>
                        <ClassStep
                          statTree={selectedTree}
                          selectedClass={props.authClass}
                          onSelectClass={props.onAuthClassChange}
                          onNext={() => setRegisterStep(3)}
                          onBack={() => setRegisterStep(1)}
                        />
                      </>
                    )}

                    {registerStep === 3 && (
                      <>
                        <h3 style={stepTitleStyle}>{t("register.stepPortrait")}</h3>
                        <PortraitStep
                          selectedPortraitId={props.authPortraitId}
                          onSelectPortrait={props.onAuthPortraitChange}
                          selectedBackgroundId={props.authBackgroundId}
                          onSelectBackground={props.onAuthBackgroundChange}
                          statTree={selectedTree}
                          selectedClass={props.authClass}
                          onSubmit={props.onRegisterSubmit}
                          onBack={() => setRegisterStep(2)}
                          error={props.error}
                        />
                      </>
                    )}
                  </div>
                  )}
                </>
              )}
            </section>

          {props.showForgotPassword ? (
            <section
              className="authCard"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                width: "min(420px, 92vw)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0 }}>{t("auth.resetPassword")}</h2>
                <button
                  onClick={props.onForgotPasswordClose}
                  style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1, padding: "0 4px" }}
                >
                  ×
                </button>
              </div>
              <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "14px" }}>
                {t("auth.resetPasswordHint")}
              </p>
              <form onSubmit={props.onForgotPasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  className="authInput"
                  type="email"
                  placeholder={t("register.emailPlaceholder")}
                  value={props.forgotPasswordEmail}
                  onChange={(e) => props.onForgotPasswordEmailChange(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary authSubmit">
                  {t("auth.sendResetLink")}
                </button>
              </form>
              {props.forgotPasswordMessage ? (
                <div style={{ padding: "8px 12px", background: "rgba(76,134,141,0.15)", borderRadius: "4px", fontSize: "13px", color: "var(--text-soft)" }}>
                  {props.forgotPasswordMessage}
                </div>
              ) : null}
            </section>
          ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Inline style constants ────────────────────────────────────────────────────

const tabsStyle: React.CSSProperties = {
  display: "flex",
  borderBottom: "1px solid var(--border-soft)",
  gap: "0"
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid var(--accent-focus)" : "2px solid transparent",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    color: active ? "var(--accent-focus)" : "var(--text-muted)",
    fontSize: "14px",
    transition: "all 160ms ease",
    marginBottom: "-1px"
  };
}

const stepTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--text-soft)",
  textAlign: "center"
};

const dividerStyle: React.CSSProperties = {
  paddingTop: "14px",
  borderTop: "1px solid var(--border-soft)"
};

const forgotLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent-info)",
  cursor: "pointer",
  fontSize: "13px",
  textDecoration: "underline",
  padding: 0
};

