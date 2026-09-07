import { FINAL_CTA } from '../content/landing';
import { WhatsAppButton } from './WhatsAppButton';

export function FinalCta() {
  return (
    <section className="final-cta" id="contato">
      <div className="container reveal">
        <div className="eyebrow">{FINAL_CTA.eyebrow}</div>
        <h2 className="display">{FINAL_CTA.title}</h2>
        <p>{FINAL_CTA.text}</p>
        <WhatsAppButton origem="fechamento" className="btn btn-gold js-whatsapp">
          {FINAL_CTA.cta}
        </WhatsAppButton>
      </div>
    </section>
  );
}
