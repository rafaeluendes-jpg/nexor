import { BENEFITS } from '../content/landing';

export function Benefits() {
  return (
    <section className="section">
      <div className="container reveal">
        <div className="eyebrow">{BENEFITS.eyebrow}</div>
        <h2 className="display">{BENEFITS.title}</h2>
        <div className="benefits-grid">
          {BENEFITS.items.map((b) => (
            <div className="benefit" key={b.num}>
              <div className="benefit-num">{b.num}</div>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
