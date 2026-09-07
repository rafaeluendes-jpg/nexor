import { FAQ } from '../content/landing';

export function Faq() {
  return (
    <section className="section" id="faq">
      <div className="container faq-grid reveal">
        <div className="faq-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FAQ.photo.src} alt={FAQ.photo.alt} />
        </div>
        <div>
          <div className="eyebrow">{FAQ.eyebrow}</div>
          <h2 className="display">{FAQ.title}</h2>
          {FAQ.items.map((item) => (
            <div className="faq-item" key={item.q}>
              <button className="faq-q" type="button" aria-expanded="false">
                {item.q}
                <span className="plus">+</span>
              </button>
              <div className="faq-a">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
