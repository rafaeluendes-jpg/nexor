import { OPPORTUNITY } from '../content/landing';

export function Opportunity() {
  return (
    <section className="section" id="modelo">
      <div className="container intro-grid reveal">
        <div className="photo-card drinks-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="base" src={OPPORTUNITY.photo.src} alt={OPPORTUNITY.photo.alt} />
        </div>
        <div className="intro-copy">
          <div className="eyebrow">{OPPORTUNITY.eyebrow}</div>
          <h2 className="display">{OPPORTUNITY.title}</h2>
          <p>{OPPORTUNITY.text}</p>
          <div className="feature-row">
            {OPPORTUNITY.cards.map((c) => (
              <div className="mini-card" key={c.title}>
                <b>{c.title}</b>
                {c.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
