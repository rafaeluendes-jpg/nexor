import { OWNERS } from '../content/landing';

export function Partners() {
  return (
    <section className="section owners" id="socios">
      <div className="container reveal">
        <div className="eyebrow">{OWNERS.eyebrow}</div>
        <h2 className="display">{OWNERS.title}</h2>
        <p>{OWNERS.text}</p>
        <div className="owners-grid">
          {OWNERS.people.map((p) => (
            <article className="owner" key={p.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo} alt={p.name} />
              <div className="owner-info">
                <h3>{p.name}</h3>
                <span>{p.role}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
