import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@jolo/shared';

const papeis = Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[];

describe('permissoes por papel', () => {
  it('nenhum papel inventa permissao fora do catalogo', () => {
    for (const papel of papeis) {
      for (const p of ROLE_PERMISSIONS[papel]) {
        expect(PERMISSIONS as readonly string[]).toContain(p);
      }
    }
  });

  it('super admin tem tudo', () => {
    expect([...ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...PERMISSIONS].sort());
  });

  it('so o super admin apaga lead', () => {
    for (const papel of papeis.filter((p) => p !== 'SUPER_ADMIN')) {
      expect(ROLE_PERMISSIONS[papel]).not.toContain('crm.leads.delete');
    }
  });

  it('visualizacao nao escreve nada', () => {
    const escrita: Permission[] = PERMISSIONS.filter((p) =>
      /\.(create|edit|delete|reply|takeover|move|upload|disable|configure)$/.test(p),
    ) as Permission[];
    for (const p of escrita) {
      expect(ROLE_PERMISSIONS.VISUALIZACAO).not.toContain(p);
    }
  });

  it('atendente e marketing nao mexem em usuarios nem em configuracao', () => {
    for (const papel of ['ATENDENTE', 'MARKETING'] as const) {
      expect(ROLE_PERMISSIONS[papel]).not.toContain('crm.users.create');
      expect(ROLE_PERMISSIONS[papel]).not.toContain('crm.settings.edit');
      expect(ROLE_PERMISSIONS[papel]).not.toContain('crm.integrations.edit');
    }
  });

  it('expansao atende a conversa e move o funil', () => {
    expect(ROLE_PERMISSIONS.EXPANSAO).toContain('crm.conversations.takeover');
    expect(ROLE_PERMISSIONS.EXPANSAO).toContain('crm.pipeline.move');
  });

  it('todo papel enxerga o painel', () => {
    for (const papel of papeis) expect(ROLE_PERMISSIONS[papel]).toContain('crm.dashboard.view');
  });
});
