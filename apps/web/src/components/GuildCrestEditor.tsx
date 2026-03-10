import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GuildCrestDisplay } from "./GuildList";
import { GUILD_CREST_COLORS } from "@ebonkeep/shared";

export interface GuildCrestConfig {
  bgShape: string;
  bgColor: string;
  bgPattern: string | null;
  fgSymbol: string;
  fgColor: string;
  frame: string | null;
}

export interface GuildCrestEditorProps {
  initialConfig?: GuildCrestConfig;
  onChange?: (config: GuildCrestConfig) => void;
}

const SHAPES = ["shield", "circle", "square", "diamond", "hexagon", "banner"];
const SYMBOLS = ["sword", "dragon", "crown", "star", "lion", "eagle", "tower", "flame"];
const BG_COLORS = ["crimson", "forest", "sapphire", "obsidian", "ivory", "gold", "iron"];
const FG_COLORS = ["silver", "bronze", "white", "black", "amber"];
const PATTERNS = ["none", "stripes", "checkerboard", "dots"];
const FRAMES = ["none", "ornate", "simple", "runic"];

export function GuildCrestEditor({ initialConfig, onChange }: GuildCrestEditorProps) {
  const { t } = useTranslation("common");

  const [config, setConfig] = useState<GuildCrestConfig>(
    initialConfig || {
      bgShape: "shield",
      bgColor: "crimson",
      bgPattern: null,
      fgSymbol: "sword",
      fgColor: "silver",
      frame: null
    }
  );

  function updateConfig(updates: Partial<GuildCrestConfig>) {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    if (onChange) {
      onChange(newConfig);
    }
  }

  return (
    <div className="guildCrestEditor">
      <div className="crestEditorPreview">
        <h4>{t("guild.crest.title")}</h4>
        <GuildCrestDisplay
          bgShape={config.bgShape}
          bgColor={config.bgColor}
          bgPattern={config.bgPattern}
          fgSymbol={config.fgSymbol}
          fgColor={config.fgColor}
          frame={config.frame}
          size="large"
        />
      </div>

      <div className="crestEditorControls">
        {/* Background Shape */}
        <div className="crestEditorSection">
          <label className="crestEditorLabel">{t("guild.crest.bgShape")}</label>
          <div className="crestEditorOptions">
            {SHAPES.map((shape) => (
              <button
                key={shape}
                className={`crestOption ${config.bgShape === shape ? "crestOption-active" : ""}`}
                onClick={() => updateConfig({ bgShape: shape })}
              >
                {t(`guild.crest.shapes.${shape}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Background Color */}
        <div className="crestEditorSection">
          <label className="crestEditorLabel">{t("guild.crest.bgColor")}</label>
          <div className="crestEditorOptions crestEditorColors">
            {BG_COLORS.map((color) => (
              <button
                key={color}
                className={`crestColorOption ${config.bgColor === color ? "crestColorOption-active" : ""}`}
                onClick={() => updateConfig({ bgColor: color })}
                style={{
                  backgroundColor: GUILD_CREST_COLORS[color as keyof typeof GUILD_CREST_COLORS]
                }}
                title={t(`guild.crest.colors.${color}`)}
              />
            ))}
          </div>
        </div>

        {/* Background Pattern */}
        <div className="crestEditorSection">
          <label className="crestEditorLabel">{t("guild.crest.bgPattern")}</label>
          <div className="crestEditorOptions">
            {PATTERNS.map((pattern) => (
              <button
                key={pattern}
                className={`crestOption ${config.bgPattern === (pattern === "none" ? null : pattern) ? "crestOption-active" : ""}`}
                onClick={() => updateConfig({ bgPattern: pattern === "none" ? null : pattern })}
              >
                {t(`guild.crest.patterns.${pattern}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Foreground Symbol */}
        <div className="crestEditorSection">
          <label className="crestEditorLabel">{t("guild.crest.fgSymbol")}</label>
          <div className="crestEditorOptions">
            {SYMBOLS.map((symbol) => (
              <button
                key={symbol}
                className={`crestOption ${config.fgSymbol === symbol ? "crestOption-active" : ""}`}
                onClick={() => updateConfig({ fgSymbol: symbol })}
              >
                {t(`guild.crest.symbols.${symbol}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Foreground Color */}
        <div className="crestEditorSection">
          <label className="crestEditorLabel">{t("guild.crest.fgColor")}</label>
          <div className="crestEditorOptions crestEditorColors">
            {FG_COLORS.map((color) => (
              <button
                key={color}
                className={`crestColorOption ${config.fgColor === color ? "crestColorOption-active" : ""}`}
                onClick={() => updateConfig({ fgColor: color })}
                style={{
                  backgroundColor: GUILD_CREST_COLORS[color as keyof typeof GUILD_CREST_COLORS]
                }}
                title={t(`guild.crest.colors.${color}`)}
              />
            ))}
          </div>
        </div>

        {/* Frame */}
        <div className="crestEditorSection">
          <label className="crestEditorLabel">{t("guild.crest.frame")}</label>
          <div className="crestEditorOptions">
            {FRAMES.map((frame) => (
              <button
                key={frame}
                className={`crestOption ${config.frame === (frame === "none" ? null : frame) ? "crestOption-active" : ""}`}
                onClick={() => updateConfig({ frame: frame === "none" ? null : frame })}
              >
                {t(`guild.crest.frames.${frame}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
