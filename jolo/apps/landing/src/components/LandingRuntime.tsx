'use client';

import { useEffect } from 'react';

/**
 * Comportamentos da pagina aprovada, no mesmo formato do original:
 * cabecalho que muda ao rolar, blocos que aparecem, FAQ que abre e
 * contadores que sobem. Sem biblioteca, sem peso extra.
 */
export function LandingRuntime() {
  useEffect(() => {
    const nav = document.getElementById('nav');
    const aoRolar = () => nav?.classList.toggle('scrolled', window.scrollY > 40);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });

    const reveals = document.querySelectorAll<HTMLElement>('.reveal');
    const revealObs = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => e.isIntersecting && e.target.classList.add('show')),
      { threshold: 0.08 },
    );
    reveals.forEach((el) => revealObs.observe(el));

    const faq = document.querySelectorAll<HTMLButtonElement>('.faq-q');
    const abrir = (btn: HTMLButtonElement) => {
      const item = btn.parentElement;
      const aberto = item?.classList.toggle('open') ?? false;
      btn.setAttribute('aria-expanded', String(aberto));
    };
    const handlers = new Map<HTMLButtonElement, () => void>();
    faq.forEach((btn) => {
      const h = () => abrir(btn);
      handlers.set(btn, h);
      btn.addEventListener('click', h);
    });

    const counters = document.querySelectorAll<HTMLElement>('.counter-num');
    counters.forEach((el) => (el.textContent = '0'));
    let contado = false;
    const subir = (el: HTMLElement) => {
      const alvo = Number(el.dataset.target ?? 0);
      let atual = 0;
      const timer = setInterval(() => {
        atual += 1;
        el.textContent = String(atual);
        el.classList.add('counter-pop');
        setTimeout(() => el.classList.remove('counter-pop'), 180);
        if (atual >= alvo) clearInterval(timer);
      }, 420);
    };
    const impact = document.querySelector('.impact');
    const counterObs = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting || contado) return;
          contado = true;
          counters.forEach(subir);
        }),
      { threshold: 0.6 },
    );
    if (impact) counterObs.observe(impact);

    return () => {
      window.removeEventListener('scroll', aoRolar);
      revealObs.disconnect();
      counterObs.disconnect();
      handlers.forEach((h, btn) => btn.removeEventListener('click', h));
    };
  }, []);

  return null;
}
