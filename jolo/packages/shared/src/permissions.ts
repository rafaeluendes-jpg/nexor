/** Catalogo de permissoes granulares do CRM (item 71 do prompt mestre). */
export const PERMISSIONS = [
  'crm.dashboard.view',
  'crm.leads.view',
  'crm.leads.create',
  'crm.leads.edit',
  'crm.leads.delete',
  'crm.conversations.view',
  'crm.conversations.reply',
  'crm.conversations.takeover',
  'crm.pipeline.view',
  'crm.pipeline.move',
  'crm.documents.view',
  'crm.documents.upload',
  'crm.reports.view',
  'crm.reports.export',
  'crm.users.view',
  'crm.users.create',
  'crm.users.edit',
  'crm.users.disable',
  'crm.settings.view',
  'crm.settings.edit',
  'crm.integrations.view',
  'crm.integrations.edit',
  'crm.ai.view',
  'crm.ai.configure',
  'crm.audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RoleKey =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'EXPANSAO'
  | 'ATENDENTE'
  | 'MARKETING'
  | 'VISUALIZACAO';

const VIEWS: Permission[] = [
  'crm.dashboard.view',
  'crm.leads.view',
  'crm.conversations.view',
  'crm.pipeline.view',
  'crm.documents.view',
  'crm.reports.view',
];

/** Permissoes de cada papel. O backend e a autoridade: esconder botao nao e seguranca. */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ADMIN: PERMISSIONS.filter((p) => p !== 'crm.leads.delete') as Permission[],
  EXPANSAO: [
    ...VIEWS,
    'crm.leads.create',
    'crm.leads.edit',
    'crm.conversations.reply',
    'crm.conversations.takeover',
    'crm.pipeline.move',
    'crm.documents.upload',
    'crm.reports.export',
    'crm.ai.view',
  ],
  ATENDENTE: [
    'crm.dashboard.view',
    'crm.leads.view',
    'crm.conversations.view',
    'crm.conversations.reply',
    'crm.conversations.takeover',
    'crm.pipeline.view',
    'crm.ai.view',
  ],
  MARKETING: [
    'crm.dashboard.view',
    'crm.leads.view',
    'crm.pipeline.view',
    'crm.reports.view',
    'crm.reports.export',
    'crm.integrations.view',
  ],
  VISUALIZACAO: [...VIEWS],
};

export function roleHasPermission(role: RoleKey, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForRoles(roles: RoleKey[]): Permission[] {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return [...set];
}
