'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearSession, getToken, getUser, type SessionUser } from '../lib/api';

interface Link {
  href: string;
  label: string;
  /** Permissao necessaria. Sem ela, o link nem aparece — e o servidor tambem barra. */
  permissao: string;
}

const MENU: { grupo: string; links: Link[] }[] = [
  {
    grupo: 'Atendimento',
    links: [
      { href: '/dashboard', label: 'Painel', permissao: 'crm.dashboard.view' },
      { href: '/inbox', label: 'Conversas', permissao: 'crm.conversations.view' },
      { href: '/pipeline', label: 'Funil', permissao: 'crm.pipeline.view' },
      { href: '/leads', label: 'Leads', permissao: 'crm.leads.view' },
      { href: '/contatos', label: 'Contatos', permissao: 'crm.leads.view' },
    ],
  },
  {
    grupo: 'Processo',
    links: [
      { href: '/agenda', label: 'Agenda', permissao: 'crm.leads.view' },
      { href: '/tarefas', label: 'Tarefas', permissao: 'crm.leads.view' },
      { href: '/cof', label: 'COF', permissao: 'crm.documents.view' },
      { href: '/documentos', label: 'Documentos', permissao: 'crm.documents.view' },
      { href: '/pracas', label: 'Pracas', permissao: 'crm.leads.view' },
    ],
  },
  {
    grupo: 'Analise',
    links: [
      { href: '/relatorios', label: 'Relatorios', permissao: 'crm.reports.view' },
      { href: '/origem', label: 'Origem dos leads', permissao: 'crm.reports.view' },
      { href: '/exportacoes', label: 'Exportacoes', permissao: 'crm.reports.export' },
    ],
  },
  {
    grupo: 'Administracao',
    links: [
      { href: '/usuarios', label: 'Usuarios e acessos', permissao: 'crm.users.view' },
      { href: '/modelos', label: 'Modelos de mensagem', permissao: 'crm.integrations.view' },
      { href: '/ia', label: 'IA de atendimento', permissao: 'crm.ai.view' },
      { href: '/integracao', label: 'Integracao WhatsApp', permissao: 'crm.integrations.view' },
      { href: '/configuracoes', label: 'Configuracoes', permissao: 'crm.settings.view' },
      { href: '/auditoria', label: 'Auditoria', permissao: 'crm.audit.view' },
    ],
  },
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

  const pode = (p: string): boolean => user.permissions.includes(p);

  return (
    <>
      <header className="topbar">
        <strong>CRM Jolô</strong>
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

      <div className="app">
        <nav className="lateral" aria-label="Areas do sistema">
          {MENU.map((secao) => {
            const visiveis = secao.links.filter((l) => pode(l.permissao));
            if (!visiveis.length) return null;
            return (
              <div key={secao.grupo}>
                <div className="grupo">{secao.grupo}</div>
                {visiveis.map((l) => (
                  <a key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? 'page' : undefined}>
                    {l.label}
                  </a>
                ))}
              </div>
            );
          })}
        </nav>
        <main className="conteudo">{children}</main>
      </div>
    </>
  );
}
