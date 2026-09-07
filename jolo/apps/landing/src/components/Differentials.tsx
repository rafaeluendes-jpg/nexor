import { DIFFERENTIALS } from '../content/landing';

export function Differentials() {
  return (
    <section className="diff">
      <div className="diff-grid reveal">
        <div className="diff-content">
          <div className="eyebrow" style={{ color: '#e7c981' }}>
            {DIFFERENTIALS.eyebrow}
          </div>
          <h2 className="display">{DIFFERENTIALS.title}</h2>
          <div className="diff-list">
            {DIFFERENTIALS.items.map((i) => (
              <div className="diff-item" key={i.title}>
                <b>{i.title}</b>
                {i.text}
              </div>
            ))}
          </div>
        </div>
        <div className="diff-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={DIFFERENTIALS.photo.src} alt={DIFFERENTIALS.photo.alt} />
        </div>
      </div>
    </section>
  );
}
