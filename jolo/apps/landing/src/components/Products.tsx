import { PRODUCTS } from '../content/landing';

export function Products() {
  return (
    <section className="products">
      <div className="container reveal">
        <div className="products-head">
          <div>
            <div className="eyebrow">{PRODUCTS.eyebrow}</div>
            <h2 className="display">{PRODUCTS.title}</h2>
          </div>
          <p>{PRODUCTS.text}</p>
        </div>
        <div className="product-grid">
          {PRODUCTS.tiles.map((t) => (
            <div className="product-tile" key={t.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.src} alt={t.alt} />
              <div className="product-caption">{t.caption}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
