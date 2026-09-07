import { INVESTMENT } from '../content/landing';
import { WhatsAppButton } from './WhatsAppButton';

export function Investment() {
  return (
    <section className="section" id="investimento">
      <div className="container invest-grid reveal">
        <div>
          <div className="eyebrow">{INVESTMENT.eyebrow}</div>
          <h2 className="display">{INVESTMENT.title}</h2>
          <p>{INVESTMENT.text}</p>
          <div className="invest-cards">
            {INVESTMENT.cards.map((c) => (
              <div className="invest-card" key={c.label}>
                <small>{c.label}</small>
                <strong>{c.value}</strong>
              </div>
            ))}
          </div>
          <div className="invest-total">
            <span>{INVESTMENT.total.label}</span>
            <strong>{INVESTMENT.total.value}</strong>
          </div>
          <p style={{ fontSize: '.78rem', color: '#777', marginTop: 12 }}>{INVESTMENT.note}</p>
          <WhatsAppButton origem="investimento" className="btn btn-primary js-whatsapp">
            {INVESTMENT.cta}
          </WhatsAppButton>
        </div>
        <div className="invest-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={INVESTMENT.photo.src} alt={INVESTMENT.photo.alt} />
        </div>
      </div>
    </section>
  );
}
