import { LOGO, NAV_LINKS } from '../content/landing';
import { WhatsAppButton } from './WhatsAppButton';

export function Header() {
  return (
    <header className="nav" id="nav">
      <div className="container nav-inner">
        <a href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="nav-logo" src={LOGO.src} alt={LOGO.alt} />
        </a>
        <nav className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <WhatsAppButton origem="header" className="btn btn-primary js-whatsapp">
            Fale com o dono
          </WhatsAppButton>
        </nav>
      </div>
    </header>
  );
}
