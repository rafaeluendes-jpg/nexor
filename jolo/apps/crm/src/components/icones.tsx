/**
 * Icones do menu. Desenhados a mao em SVG, sem biblioteca:
 * sao dezenove tracos simples e nao vale carregar um pacote inteiro
 * numa ferramenta que precisa abrir rapido.
 */
const base = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const Icone = {
  painel: () => (
    <svg {...base}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
  ),
  conversa: () => (
    <svg {...base}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.4-.7L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></svg>
  ),
  funil: () => (
    <svg {...base}><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" /></svg>
  ),
  leads: () => (
    <svg {...base}><path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.4" /><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M16 4.3a3.4 3.4 0 0 1 0 6.6" /></svg>
  ),
  contatos: () => (
    <svg {...base}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.6" /><path d="M8 17.2a4.2 4.2 0 0 1 8 0" /></svg>
  ),
  agenda: () => (
    <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
  ),
  tarefas: () => (
    <svg {...base}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1.2 1.2L7.4 5M4 12l1.2 1.2L7.4 11M4 18l1.2 1.2L7.4 17" /></svg>
  ),
  cof: () => (
    <svg {...base}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v4M10 14h4" /></svg>
  ),
  documentos: () => (
    <svg {...base}><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z" /><path d="M13 3v7h7M8 14h8M8 17.5h5" /></svg>
  ),
  pracas: () => (
    <svg {...base}><path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
  ),
  relatorios: () => (
    <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
  ),
  origem: () => (
    <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v8.5l6 3.4" /></svg>
  ),
  exportacoes: () => (
    <svg {...base}><path d="M12 3v11M8.5 10.5 12 14l3.5-3.5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
  ),
  usuarios: () => (
    <svg {...base}><circle cx="12" cy="8" r="3.6" /><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /></svg>
  ),
  modelos: () => (
    <svg {...base}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h6" /></svg>
  ),
  ia: () => (
    <svg {...base}><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M12 4v3M9 12.5h.01M15 12.5h.01M9.5 16h5" /></svg>
  ),
  integracao: () => (
    <svg {...base}><path d="M9 7 5.5 10.5a4.6 4.6 0 0 0 6.5 6.5L15 13.5" /><path d="M15 17l3.5-3.5a4.6 4.6 0 0 0-6.5-6.5L9 10.5" /></svg>
  ),
  configuracoes: () => (
    <svg {...base}><circle cx="12" cy="12" r="3.2" /><path d="M19.2 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" /></svg>
  ),
  auditoria: () => (
    <svg {...base}><path d="M12 3 4 6v5.5c0 4.6 3.2 8.4 8 9.5 4.8-1.1 8-4.9 8-9.5V6l-8-3z" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  importar: () => (
    <svg {...base}><path d="M12 15V4M8.5 7.5 12 4l3.5 3.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
  ),
  menu: () => (
    <svg {...base} width="18" height="18"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
  ),
};

export type NomeDeIcone = keyof typeof Icone;
