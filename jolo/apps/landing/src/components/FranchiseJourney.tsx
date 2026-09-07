import { JOURNEY } from '../content/landing';

export function FranchiseJourney() {
  return (
    <section className="section journey" id="jornada">
      <div className="container reveal">
        <div className="eyebrow">{JOURNEY.eyebrow}</div>
        <h2 className="display">{JOURNEY.title}</h2>
        <div className="journey-steps">
          {JOURNEY.steps.map((s) => (
            <div className="step" key={s.n}>
              <span>{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
