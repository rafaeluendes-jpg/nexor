import { TRAINING } from '../content/landing';

export function Training() {
  return (
    <section className="section">
      <div className="container training-grid reveal">
        <div>
          <div className="eyebrow">{TRAINING.eyebrow}</div>
          <h2 className="display">{TRAINING.title}</h2>
          {TRAINING.weeks.map((w) => (
            <div className="week" key={w.n}>
              <b className="num">{w.n}</b>
              <div>
                <b>{w.title}</b>
                <p>{w.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="training-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TRAINING.photo.src} alt={TRAINING.photo.alt} />
        </div>
      </div>
    </section>
  );
}
