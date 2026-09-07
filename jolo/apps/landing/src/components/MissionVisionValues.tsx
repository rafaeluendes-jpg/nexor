import { PURPOSE } from '../content/landing';

export function MissionVisionValues() {
  return (
    <section className="purpose" id="proposito">
      <div className="container reveal">
        <div className="purpose-panel">
          <div className="eyebrow">{PURPOSE.eyebrow}</div>
          <h2 className="display">{PURPOSE.title}</h2>
          <div className="purpose-grid">
            <div>
              <h3>{PURPOSE.mission.title}</h3>
              <p>{PURPOSE.mission.text}</p>
              <h3>{PURPOSE.vision.title}</h3>
              <p>{PURPOSE.vision.text}</p>
            </div>
            <div className="values">
              {PURPOSE.values.map((v) => (
                <div className="value" key={v.title}>
                  <b>{v.title}</b> {v.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
