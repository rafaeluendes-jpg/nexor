import { HISTORY } from '../content/landing';

export function History() {
  return (
    <section className="section">
      <div className="container history-grid reveal">
        <div>
          <div className="eyebrow">{HISTORY.eyebrow}</div>
          <h2 className="display">{HISTORY.title}</h2>
          {HISTORY.paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
        <div className="photo-card history-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HISTORY.photo.src} alt={HISTORY.photo.alt} />
        </div>
      </div>
    </section>
  );
}
