export type PlaceholderPanelProps = {
  title: string;
  description: string;
};

export function PlaceholderPanel({ title, description }: PlaceholderPanelProps) {
  return (
    <section className="contentShell">
      <section className="contentStack">
        <article className="contentCard">
          <h2>{title}</h2>
          <p>{description}</p>
        </article>
      </section>
    </section>
  );
}
