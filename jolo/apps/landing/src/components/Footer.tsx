import { FOOTER, LOGO } from '../content/landing';

export function Footer() {
  return (
    <footer>
      <div className="container footer-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="footer-logo" src={LOGO.src} alt={LOGO.alt} />
        <div>{FOOTER.copyright}</div>
        <div>
          <a href="/politica-de-privacidade">Política de Privacidade</a> · <a href="/termos">Termos</a>
        </div>
      </div>
    </footer>
  );
}
