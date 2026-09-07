'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, clearSession, getToken, getUser, type SessionUser } from '../lib/api';
import { Icone, type NomeDeIcone } from './icones';

interface Link {
  href: string;
  label: string;
  icone: NomeDeIcone;
  /** Permissao necessaria. Sem ela o link nem aparece — e o servidor tambem barra. */
  permissao: string;
}

const MENU: { grupo: string; links: Link[] }[] = [
  {
    grupo: 'Atendimento',
    links: [
      { href: '/dashboard', label: 'Painel', icone: 'painel', permissao: 'crm.dashboard.view' },
      { href: '/inbox', label: 'Conversas', icone: 'conversa', permissao: 'crm.conversations.view' },
      { href: '/pipeline', label: 'Funil', icone: 'funil', permissao: 'crm.pipeline.view' },
      { href: '/leads', label: 'Leads', icone: 'leads', permissao: 'crm.leads.view' },
      { href: '/contatos', label: 'Contatos', icone: 'contatos', permissao: 'crm.leads.view' },
    ],
  },
  {
    grupo: 'Processo',
    links: [
      { href: '/agenda', label: 'Agenda', icone: 'agenda', permissao: 'crm.leads.view' },
      { href: '/tarefas', label: 'Tarefas', icone: 'tarefas', permissao: 'crm.leads.view' },
      { href: '/cof', label: 'COF', icone: 'cof', permissao: 'crm.documents.view' },
      { href: '/documentos', label: 'Documentos', icone: 'documentos', permissao: 'crm.documents.view' },
      { href: '/pracas', label: 'Praças', icone: 'pracas', permissao: 'crm.leads.view' },
    ],
  },
  {
    grupo: 'Análise',
    links: [
      { href: '/relatorios', label: 'Relatórios', icone: 'relatorios', permissao: 'crm.reports.view' },
      { href: '/origem', label: 'Origem dos leads', icone: 'origem', permissao: 'crm.reports.view' },
      { href: '/exportacoes', label: 'Exportações', icone: 'exportacoes', permissao: 'crm.reports.export' },
    ],
  },
  {
    grupo: 'Administração',
    links: [
      { href: '/usuarios', label: 'Usuários e acessos', icone: 'usuarios', permissao: 'crm.users.view' },
      { href: '/modelos', label: 'Modelos de mensagem', icone: 'modelos', permissao: 'crm.integrations.view' },
      { href: '/ia', label: 'IA de atendimento', icone: 'ia', permissao: 'crm.ai.view' },
      { href: '/integracao', label: 'Integração WhatsApp', icone: 'integracao', permissao: 'crm.integrations.view' },
      { href: '/configuracoes', label: 'Configurações', icone: 'configuracoes', permissao: 'crm.settings.view' },
      { href: '/auditoria', label: 'Auditoria', icone: 'auditoria', permissao: 'crm.audit.view' },
    ],
  },
];

const NOME_DO_PAPEL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  EXPANSAO: 'Expansão',
  ATENDENTE: 'Atendente',
  MARKETING: 'Marketing',
  VISUALIZACAO: 'Visualização',
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? '' : '';
  return (primeira + ultima).toUpperCase();
}

/** Casca autenticada. Sem token válido, ninguém vê tela interna. */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setUser(getUser());
    // Confere no servidor: token guardado não vale se a sessão foi revogada.
    api<{ user: SessionUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => router.replace('/login'));
  }, [router]);

  // Trocar de tela no celular fecha o menu; senão ele fica por cima do conteúdo.
  useEffect(() => setMenuAberto(false), [pathname]);

  if (!user) return <div className="vazio">Carregando…</div>;

  const pode = (p: string): boolean => user.permissions.includes(p);
  const papel = NOME_DO_PAPEL[user.roles[0] ?? ''] ?? user.roles[0] ?? '';

  return (
    <div className="app" data-menu={menuAberto ? 'aberto' : 'fechado'}>
      <nav className="lateral" aria-label="Áreas do sistema">
        <div className="marca">
          <span className="cone" aria-hidden="true">J</span>
          <span>
            <b>Jolô Gelato</b>
            <small>Franquias</small>
          </span>
        </div>

        {MENU.map((secao) => {
          const visiveis = secao.links.filter((l) => pode(l.permissao));
          if (!visiveis.length) return null;
          return (
            <div key={secao.grupo}>
              <div className="grupo">{secao.grupo}</div>
              {visiveis.map((l) => {
                const Desenho = Icone[l.icone];
                return (
                  <a key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? 'page' : undefined}>
                    <Desenho />
                    {l.label}
                  </a>
                );
              })}
            </div>
          );
        })}
      </nav>

      {menuAberto ? (
        <button type="button" className="veu" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />
      ) : null}

      <div className="corpo">
        <header className="topo">
          <button
            type="button"
            className="abrir-menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto((a) => !a)}
          >
            <Icone.menu />
            Menu
          </button>

          <div className="quem">
            <span className="inicial" aria-hidden="true">{iniciais(user.name)}</span>
            <span>
              {user.name}
              <span className="papel" style={{ display: 'block' }}>{papel}</span>
            </span>
            <button
              type="button"
              className="sair"
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

        <main className="conteudo">{children}</main>
      </div>
    </div>
  );
}
