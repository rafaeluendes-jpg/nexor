/**
 * Conteudo da landing aprovada. Texto separado do componente:
 * mudar uma palavra nao exige mexer em codigo de layout.
 *
 * Fonte: legacy/landing-approved.html. Nao alterar sem pedido do Rafael.
 */

export const NAV_LINKS = [
  { href: '#modelo', label: 'Oportunidade' },
  { href: '#trajetoria', label: 'Trajetória' },
  { href: '#proposito', label: 'Missão & valores' },
  { href: '#investimento', label: 'Investimento' },
  { href: '#socios', label: 'Sócios' },
  { href: '#faq', label: 'FAQ' },
] as const;

export const HERO = {
  eyebrow: 'Seja um franqueado · Jolô Gelato',
  title: ['Mais que gelato.', 'Um negócio feito para valer a pena.'],
  text: 'Uma marca artesanal que gera desejo no cliente, transforma momentos simples em experiência e leva ao franqueado um modelo de operação construído na prática.',
  cta: 'Fale com o dono no WhatsApp ↗',
  meta: ['Produto artesanal', 'Modelo testado', 'Suporte próximo'],
} as const;

export const OPPORTUNITY = {
  eyebrow: 'A oportunidade Jolô',
  title: 'Uma marca feita para o cliente desejar — e para o franqueado operar.',
  text: 'Produto, loja, atendimento, gestão e marketing precisam falar a mesma língua. A Jolô reúne esses pilares em uma proposta com identidade própria e experiência de consumo forte.',
  cards: [
    { title: 'Produto', text: 'Gelato artesanal e cardápio autoral.' },
    { title: 'Operação', text: 'Processos e padrões definidos.' },
    { title: 'Marca', text: 'Visual, ambiente e comunicação alinhados.' },
  ],
  photo: { src: '/assets/milkshakes.jpg', alt: 'Três bebidas Jolô' },
} as const;

export const DIFFERENTIALS = {
  eyebrow: 'Diferenciais',
  title: 'Estrutura por trás de uma experiência que parece simples.',
  items: [
    { title: 'Gelato artesanal', text: 'Técnica, textura e padrão de produto.' },
    { title: 'Preparo Lácteo Alimentício', text: 'Padronização de insumos, fichas e processos.' },
    { title: 'Suporte ao franqueado', text: 'Implantação, treinamento e acompanhamento.' },
    { title: 'Gestão integrada', text: 'Indicadores, estoque, vendas e financeiro.' },
  ],
  photo: { src: '/assets/producao-manga.jpg', alt: 'Produção artesanal Jolô' },
} as const;

export const IMPACT = {
  eyebrow: 'Uma rede em expansão',
  title: 'Números que contam a nossa história.',
  counters: [
    { icon: '⌖', target: 2, label: 'Estados', note: 'São Paulo + Rio de Janeiro' },
    { icon: '▣', target: 6, label: 'Unidades', note: 'rede Jolô' },
    { icon: '◷', target: 6, label: 'Anos de história', note: 'desde 2020' },
  ],
  cta: 'Fale com o dono ↗',
} as const;

export const TRAJECTORY = {
  eyebrow: 'Nossa trajetória',
  title: 'Cada unidade marca um novo capítulo.',
  text: 'Do nascimento da primeira loja à chegada em novos mercados, a expansão foi acontecendo passo a passo.',
  items: [
    { date: 'Mar 2020', title: 'Três Fronteiras/SP', text: 'Inauguração da primeira Jolô Gelato.' },
    { date: 'Jun 2021', title: 'Santa Fé do Sul/SP', text: 'Expansão para a segunda unidade.' },
    { date: 'Jul 2023', title: 'Jolô Franchising', text: 'Lançamento oficial do modelo de franquias.' },
    { date: 'Out 2024', title: 'Jales/SP', text: 'Abertura da unidade.' },
    { date: 'Nov 2024', title: 'Fernandópolis/SP', text: 'Abertura da unidade.' },
    { date: 'Dez 2024', title: 'Sorocaba/SP', text: 'Abertura da unidade.' },
    { date: 'Abr 2026', title: 'Petrópolis/RJ', text: 'Abertura da unidade e chegada ao segundo estado.' },
    {
      date: '2026 · em implantação',
      title: 'São Paulo/SP',
      text: 'Unidade da capital em andamento, com abertura prevista para novembro.',
    },
  ],
} as const;

export const HISTORY = {
  eyebrow: 'Nossa história',
  title: 'Nascida de produto. Construída com operação.',
  paragraphs: [
    'A Jolô nasceu em 2020, em Três Fronteiras/SP, unindo tradição familiar, técnica de gelato e vontade de criar algo único. A experiência de loja, a qualidade do produto e a evolução da operação abriram caminho para novas unidades e para o modelo de franquias.',
    'O crescimento preserva a essência: fazer um produto que gere vontade, criar uma loja que seja lembrada e construir uma operação capaz de repetir essa experiência.',
  ],
  photo: { src: '/assets/casquinha-letreiro.jpg', alt: 'Gelato Jolô em frente à loja' },
} as const;

export const PURPOSE = {
  eyebrow: 'O que guia a Jolô',
  title: 'Missão, visão e valores.',
  mission: {
    title: 'Missão',
    text: 'Levar a experiência do sabor Jolô para todo o Brasil através do modelo de franquias, rentabilizando todos os stakeholders.',
  },
  vision: {
    title: 'Visão',
    text: 'Ser reconhecida pela rede de franqueados como um negócio próspero que transforma vidas.',
  },
  values: [
    { title: 'Paixão', text: 'Pelo que faz e pelo crescimento contínuo.' },
    { title: 'Paciência', text: 'Para crescer com qualidade e consistência.' },
    { title: 'Perseverança', text: 'Para construir um negócio sólido e próspero.' },
  ],
} as const;

export const PRODUCTS = {
  eyebrow: 'Desejo de marca',
  title: 'Produtos que conquistam antes mesmo da primeira colherada.',
  text: 'Em vez de repetir imagens, a página mostra diferentes momentos do cardápio e da produção para reforçar variedade, cuidado e experiência.',
  tiles: [
    { src: '/assets/brownie.jpg', alt: 'Brownie Jolô', caption: 'Brownie · experiência quente e gelada' },
    { src: '/assets/fatiatto-coco.jpg', alt: 'Fatiatto di Gelato', caption: 'Fatiatto di Gelato' },
    { src: '/assets/copinho.jpg', alt: 'Copinho de gelato Jolô', caption: 'Gelato no copinho' },
  ],
} as const;

export const BENEFITS = {
  eyebrow: 'Estrutura de franquia',
  title: 'O que o franqueado recebe para operar.',
  items: [
    {
      num: '01',
      title: 'Produto exclusivo e de alta qualidade',
      text: 'Preparo lácteo alimentício para produzir o seu próprio gelato.',
    },
    { num: '02', title: 'Operação simples e padronizada', text: 'Rotinas e processos organizados para a unidade.' },
    { num: '03', title: 'Tecnologia de gestão', text: 'Sistema integrado para apoiar financeiro, estoque e vendas.' },
    { num: '04', title: 'Marketing estruturado', text: 'Campanhas e materiais para construção de marca e vendas.' },
    { num: '05', title: 'Implantação acompanhada', text: 'Do ponto à inauguração, com etapas e suporte.' },
    { num: '06', title: 'Treinamento prático', text: 'Aprendizado aplicado à rotina da operação.' },
  ],
} as const;

export const JOURNEY = {
  eyebrow: 'Como funciona',
  title: 'Da primeira conversa à inauguração.',
  steps: [
    { n: 1, title: 'Conhecer a apresentação', text: 'Entender a proposta e o modelo.' },
    { n: 2, title: 'Ficha de qualificação', text: 'Preenchimento do perfil para análise.' },
    { n: 3, title: 'Reunião estratégica', text: 'Conversa com o time de expansão.' },
    { n: 4, title: 'Visita à operação', text: 'Conhecer uma unidade e a rotina real.' },
    { n: 5, title: 'COF e contrato', text: 'Recebimento da COF e formalização.' },
    { n: 6, title: 'Plano de inauguração', text: 'Implantação, treinamento e abertura.' },
  ],
} as const;

export const TRAINING = {
  eyebrow: 'Preparação para o sucesso',
  title: 'Treinamento em três semanas-chave.',
  weeks: [
    {
      n: 1,
      title: 'Imersão na sede da franqueadora',
      text: 'Conhecer a estrutura, os processos e o modelo de negócio Jolô.',
    },
    { n: 2, title: 'Treinamento na unidade franqueada', text: 'Aplicar o conhecimento na prática e preparar a equipe.' },
    { n: 3, title: 'Acompanhamento pós-inauguração', text: 'Ajustes operacionais, suporte e consolidação da rotina.' },
  ],
  photo: { src: '/assets/cuba-manga.jpg', alt: 'Finalização do gelato Jolô' },
} as const;

export const PROFILE = {
  eyebrow: 'Perfil do franqueado',
  title: 'Procuramos quem queira construir um negócio de verdade.',
  text: 'Atitude empreendedora, capacidade de gestão e identificação com os valores Jolô são mais importantes que apenas gostar de gelato.',
  items: [
    { title: 'Visão empreendedora', text: 'Proatividade, dinamismo e visão de negócio.' },
    { title: 'Gostar de pessoas', text: 'Atender, liderar e encantar clientes.' },
    { title: 'Responsabilidade e resiliência', text: 'Capacidade de gerenciar desafios.' },
    { title: 'Alinhamento com a Jolô', text: 'Paixão, Paciência e Perseverança.' },
  ],
} as const;

export const INVESTMENT = {
  eyebrow: 'Investimento',
  title: 'R$ 350 mil de investimento total estimado.',
  text: 'A composição varia conforme ponto, projeto, formato da unidade, equipamentos, obra, frente de loja, estoque e capital de giro.',
  cards: [
    { label: 'Taxa de franquia', value: 'R$ 30.000' },
    { label: 'Equipamentos*', value: 'R$ 120.000' },
    { label: 'Frente de loja e utensílios', value: 'R$ 70.000' },
    { label: 'Estoque inicial', value: 'R$ 15.000' },
    { label: 'Capital de giro', value: 'R$ 35.000' },
  ],
  total: { label: 'Investimento total estimado', value: 'R$ 350.000' },
  note: '*A composição dos itens pode variar. O investimento total estimado considerado para o modelo é de R$ 350.000.',
  cta: 'Quero entender o investimento ↗',
  photo: { src: '/assets/cuba-chocolate.jpg', alt: 'Gelato Jolô em cuba' },
} as const;

export const OWNERS = {
  eyebrow: 'Quem está por trás da Jolô',
  title: 'Sócios presentes no negócio.',
  text: 'Produto, operação, gestão e expansão acompanhados de perto por quem constrói a Jolô todos os dias.',
  people: [
    {
      name: 'Rafael Ulian',
      role: 'Mestre Gelatiere · Produto & Marketing',
      photo: '/assets/socio-rafael-ulian.jpg',
    },
    { name: 'Ricardo Soares', role: 'Sócio · Gestão & Expansão', photo: '/assets/socio-ricardo-soares.jpg' },
    { name: 'Raylan Souza', role: 'Diretor de Operação', photo: '/assets/socio-raylan-souza.jpg' },
  ],
} as const;

export const FAQ = {
  eyebrow: 'Perguntas frequentes',
  title: 'Antes de conversar, tire as principais dúvidas.',
  photo: { src: '/assets/cuba-amora.jpg', alt: 'Cuba de gelato Jolô' },
  items: [
    {
      q: 'Qual é o investimento total estimado?',
      a: 'O investimento total estimado informado para o modelo é de R$ 350.000, podendo variar na composição conforme ponto, projeto e formato da unidade.',
    },
    {
      q: 'Onde a Jolô já está presente?',
      a: 'A trajetória inclui unidades em São Paulo e Rio de Janeiro, com São Paulo capital em implantação.',
    },
    {
      q: 'Por que ter uma franquia da Jolô?',
      a: 'Para operar um negócio com marca, produto, processos, suporte e acompanhamento já estruturados.',
    },
    {
      q: 'A Jolô ajuda na escolha do ponto?',
      a: 'Sim. A jornada de implantação prevê apoio na identificação do imóvel e adequação ao padrão da marca.',
    },
    {
      q: 'Tenho o dinheiro para investir. Qual é o próximo passo?',
      a: 'Clique em “Fale com o dono” para iniciar a conversa pelo WhatsApp e avançar para a etapa de qualificação.',
    },
  ],
} as const;

export const FINAL_CTA = {
  eyebrow: 'Seu próximo negócio pode começar aqui',
  title: 'Talvez a próxima Jolô seja sua.',
  text: 'Fale diretamente com quem construiu a operação e entenda se o modelo faz sentido para você e para a sua cidade.',
  cta: 'Fale com o dono no WhatsApp ↗',
} as const;

export const FOOTER = {
  copyright: '© 2026 Jolô Gelato · Feito para valer a pena.',
  links: 'Política de Privacidade · Termos',
} as const;

export const LOGO = { src: '/assets/logo-jolo.png', alt: 'Jolô Gelato' } as const;
