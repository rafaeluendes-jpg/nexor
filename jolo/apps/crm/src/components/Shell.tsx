'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearSession, getToken, getUser, type SessionUser } from '../lib/api';

const LINKS = [
  { href: '/dashboard', label: 'Painel' },
  { href: '/inbox', label: 'Conversas' },
  { href: '/pipeline', label: 'Funil' },
];

/** Casca autenticada. Sem token valido, ninguem ve tela interna. */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setUser(getUser());
    // Confere no servidor: token guardado nao vale se a sessao foi revogada.
    api<{ user: SessionUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!user) return <div className="vazio">Carregando…</div>;

  return (
    <>
      <header className="topbar">
        <strong>CRM Jolô</strong>
        <nav>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? 'page' : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="quem">
            {user.name} · {user.roles.join(', ')}
          </span>
          <button
            type="button"
            onClick={() => {
              void api('/auth/logout', { method: 'POST' }).finally(() => {
                clearSession();
                router.replace('/login');
              });
            }}
          >
            Sair
          </button>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
