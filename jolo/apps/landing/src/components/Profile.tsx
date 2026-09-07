import { PROFILE } from '../content/landing';

export function Profile() {
  return (
    <section className="section profile">
      <div className="container reveal">
        <div className="eyebrow">{PROFILE.eyebrow}</div>
        <h2 className="display">{PROFILE.title}</h2>
        <p style={{ maxWidth: 760, color: 'rgba(255,255,255,.78)' }}>{PROFILE.text}</p>
        <div className="profile-grid">
          {PROFILE.items.map((i) => (
            <div className="profile-item" key={i.title}>
              <b>{i.title}</b>
              {i.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
