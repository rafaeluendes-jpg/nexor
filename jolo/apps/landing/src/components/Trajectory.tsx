import { TRAJECTORY } from '../content/landing';

export function Trajectory() {
  return (
    <section className="section trajectory" id="trajetoria">
      <div className="container reveal">
        <div className="trajectory-head">
          <div className="eyebrow">{TRAJECTORY.eyebrow}</div>
          <h2 className="display">{TRAJECTORY.title}</h2>
          <p>{TRAJECTORY.text}</p>
        </div>
        <div className="timeline-grid">
          {TRAJECTORY.items.map((t) => (
            <div className="time-card" key={`${t.date}-${t.title}`}>
              <div className="time-date">{t.date}</div>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
