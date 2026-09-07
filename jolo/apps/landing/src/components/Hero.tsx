import { HERO } from '../content/landing';
import { WhatsAppButton } from './WhatsAppButton';

export function Hero() {
  return (
    <section className="hero">
      <div className="container hero-inner reveal">
        <div className="eyebrow" style={{ color: '#ecd098' }}>
          {HERO.eyebrow}
        </div>
        <h1 className="display">
          {HERO.title[0]}
          <br />
          {HERO.title[1]}
        </h1>
        <p>{HERO.text}</p>
        <WhatsAppButton origem="hero" className="btn btn-gold js-whatsapp">
          {HERO.cta}
        </WhatsAppButton>
        <div className="hero-meta">
          {HERO.meta.map((m) => (
            <span key={m}>
              <i />
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
