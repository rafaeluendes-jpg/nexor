import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type RoleName } from '@prisma/client';
import { DEFAULT_PIPELINE_NAME, PERMISSIONS, PIPELINE_STAGES, ROLE_PERMISSIONS } from '@jolo/shared';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  SUPER_ADMIN: 'Controle completo do sistema.',
  ADMIN: 'Gestao operacional e de usuarios autorizados.',
  EXPANSAO: 'Leads, conversas, pipeline, tarefas, reunioes e documentos.',
  ATENDENTE: 'Conversas e leads permitidos.',
  MARKETING: 'Campanhas, origem, anuncios, analytics e relatorios.',
  VISUALIZACAO: 'Somente leitura das areas autorizadas.',
};

const QUALIFICATION = [
  { key: 'nome', label: 'Nome' },
  { key: 'cidade_atual', label: 'Cidade e estado onde mora' },
  { key: 'cidade_desejada', label: 'Cidade onde deseja abrir' },
  { key: 'capital', label: 'Capital disponivel ou faixa' },
  { key: 'prazo', label: 'Prazo para investir' },
  { key: 'experiencia', label: 'Experiencia empresarial' },
  { key: 'socio', label: 'Possui sociedade' },
  { key: 'disponibilidade', label: 'Disponibilidade para atuar no negocio' },
  { key: 'horario', label: 'Melhor horario para conversar' },
  { key: 'reuniao', label: 'Interesse em reuniao' },
];

const SCORE_RULES = [
  { key: 'capital_compativel', label: 'Capital compativel com o investimento', points: 25 },
  { key: 'prazo_curto', label: 'Prazo curto para investir', points: 20 },
  { key: 'cidade_disponivel', label: 'Cidade disponivel para a rede', points: 20 },
  { key: 'perfil_empreendedor', label: 'Perfil empreendedor', points: 15 },
  { key: 'disponibilidade_operacao', label: 'Disponibilidade para operar', points: 10 },
  { key: 'engajamento', label: 'Engajamento na conversa', points: 10 },
];

/** Unidades ja existentes da rede, marcadas como vendidas/ocupadas. */
const TERRITORIES = [
  { city: 'Tres Fronteiras', state: 'SP', status: 'VENDIDA' as const },
  { city: 'Santa Fe do Sul', state: 'SP', status: 'VENDIDA' as const },
  { city: 'Jales', state: 'SP', status: 'VENDIDA' as const },
  { city: 'Fernandopolis', state: 'SP', status: 'VENDIDA' as const },
  { city: 'Sorocaba', state: 'SP', status: 'VENDIDA' as const },
  { city: 'Petropolis', state: 'RJ', status: 'VENDIDA' as const },
  { city: 'Sao Paulo', state: 'SP', status: 'NEGOCIACAO' as const },
];

const SOURCES = [
  { key: 'instagram', name: 'Instagram' },
  { key: 'facebook', name: 'Facebook' },
  { key: 'google', name: 'Google' },
  { key: 'whatsapp', name: 'WhatsApp direto' },
  { key: 'landing', name: 'Landing page' },
  { key: 'organico', name: 'Organico' },
  { key: 'indicacao', name: 'Indicacao' },
  { key: 'outros', name: 'Outros' },
];

async function main(): Promise<void> {
  // ---------- organizacao ----------
  const org = await prisma.organization.upsert({
    where: { slug: 'jolo-gelato' },
    create: { name: 'Jolo Gelato Franquias', slug: 'jolo-gelato' },
    update: {},
  });

  // ---------- permissoes e papeis ----------
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }
  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: name as RoleName },
      create: { name: name as RoleName, description: ROLE_DESCRIPTIONS[name as RoleName] },
      update: { description: ROLE_DESCRIPTIONS[name as RoleName] },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const rows = await prisma.permission.findMany({ where: { code: { in: permissions } } });
    await prisma.rolePermission.createMany({
      data: rows.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  // ---------- pipeline ----------
  const pipeline = await prisma.pipeline.upsert({
    where: { organizationId_name: { organizationId: org.id, name: DEFAULT_PIPELINE_NAME } },
    create: { organizationId: org.id, name: DEFAULT_PIPELINE_NAME, isDefault: true },
    update: { isDefault: true },
  });
  for (const [index, stage] of PIPELINE_STAGES.entries()) {
    await prisma.pipelineStage.upsert({
      where: { pipelineId_key: { pipelineId: pipeline.id, key: stage.key } },
      create: {
        pipelineId: pipeline.id,
        key: stage.key,
        name: stage.name,
        position: index,
        color: stage.color,
        isWon: 'isWon' in stage ? Boolean(stage.isWon) : false,
        isLost: 'isLost' in stage ? Boolean(stage.isLost) : false,
      },
      update: { name: stage.name, position: index, color: stage.color },
    });
  }

  // ---------- qualificacao e score ----------
  for (const [index, q] of QUALIFICATION.entries()) {
    await prisma.qualificationQuestion.upsert({
      where: { key: q.key },
      create: { key: q.key, label: q.label, position: index },
      update: { label: q.label, position: index },
    });
  }
  for (const r of SCORE_RULES) {
    await prisma.scoreRule.upsert({
      where: { key: r.key },
      create: { key: r.key, label: r.label, points: r.points },
      update: { label: r.label, points: r.points },
    });
  }

  // ---------- origens e pracas ----------
  for (const s of SOURCES) {
    await prisma.adSource.upsert({ where: { key: s.key }, create: s, update: {} });
  }
  for (const t of TERRITORIES) {
    await prisma.territory.upsert({
      where: { organizationId_city_state: { organizationId: org.id, city: t.city, state: t.state } },
      create: { organizationId: org.id, ...t },
      update: { status: t.status },
    });
  }

  // ---------- templates de whatsapp ----------
  const templates = [
    {
      name: 'primeiro_contato',
      category: 'MARKETING',
      bodyText: 'Ola, {{1}}! Aqui e da Jolo Gelato Franquias. Recebemos seu interesse pela franquia. Posso te explicar como funciona?',
    },
    {
      name: 'follow_up_24h',
      category: 'UTILITY',
      bodyText: 'Oi, {{1}}! Passando para saber se ficou alguma duvida sobre a franquia Jolo. Posso ajudar?',
    },
    {
      name: 'lembrete_reuniao',
      category: 'UTILITY',
      bodyText: 'Oi, {{1}}! Lembrete da nossa reuniao sobre a franquia Jolo em {{2}}. Ate la!',
    },
  ];
  for (const t of templates) {
    await prisma.whatsappTemplate.upsert({ where: { name: t.name }, create: t, update: {} });
  }

  // ---------- usuario administrador ----------
  const emailAdmin = process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br';
  const senhaAdmin = process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026';
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });

  const admin = await prisma.user.upsert({
    where: { email: emailAdmin },
    create: {
      organizationId: org.id,
      email: emailAdmin,
      name: 'Administrador Jolo',
      status: 'ACTIVE',
      // Hash local usado apenas em desenvolvimento. Em producao a senha vive no Supabase Auth.
      devPasswordHash: process.env.NODE_ENV === 'production' ? null : await hash(senhaAdmin, 12),
    },
    update: {},
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdmin.id } },
    create: { userId: admin.id, roleId: superAdmin.id },
    update: {},
  });

  console.log('Seed concluido.');
  console.log(`  organizacao: ${org.name}`);
  console.log(`  etapas do funil: ${PIPELINE_STAGES.length}`);
  console.log(`  permissoes: ${PERMISSIONS.length}`);
  console.log(`  admin: ${emailAdmin}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('  senha de desenvolvimento definida por SEED_ADMIN_PASSWORD (padrao no .env.example).');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
