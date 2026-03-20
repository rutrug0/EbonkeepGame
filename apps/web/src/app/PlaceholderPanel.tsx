import type { CSSProperties } from "react";

import { getViewBackgroundStyle, type ViewBackgroundName } from "../lib/viewBackgrounds";

export type PlaceholderPanelProps = {
  title: string;
  description: string;
  backgroundName?: ViewBackgroundName;
};

export function PlaceholderPanel({ title, description, backgroundName }: PlaceholderPanelProps) {
  const backgroundStyle = backgroundName
    ? (getViewBackgroundStyle(backgroundName) as CSSProperties)
    : undefined;

  return (
    <section className={`contentShell${backgroundName ? " indoorSceneShell placeholderBackgroundShell" : ""}`} style={backgroundStyle}>
      <section className="contentStack">
        <article className="contentCard">
          <h2>{title}</h2>
          <p>{description}</p>
        </article>
      </section>
    </section>
  );
}
