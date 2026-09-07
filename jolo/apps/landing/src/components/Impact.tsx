import { IMPACT } from '../content/landing';
import { WhatsAppButton } from './WhatsAppButton';

export function Impact() {
  return (
    <section className="impact" id="rede">
      <div className="container reveal">
        <div className="eyebrow">{IMPACT.eyebrow}</div>
        <h2 className="display">{IMPACT.title}</h2>
        <div className="counter-grid">
          {IMPACT.counters.map((c) => (
            <div className="counter-card" key={c.label}>
              <div className="counter-icon">{c.icon}</div>
              <div className="counter-num" data-target={c.target}>
                0
              </div>
              <div className="counter-label">{c.label}</div>
              <div className="counter-note">{c.note}</div>
            </div>
          ))}
        </div>
        <WhatsAppButton origem="impacto" className="btn btn-gold js-whatsapp">
          {IMPACT.cta}
        </WhatsAppButton>
      </div>
    </section>
  );
}
