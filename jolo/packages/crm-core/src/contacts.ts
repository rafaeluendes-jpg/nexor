import type { Contact, PrismaClient } from '@jolo/database';
import { normalizePhoneBR, phoneMatchKeys } from '@jolo/shared';

export interface UpsertContactInput {
  organizationId: string;
  phone: string;
  whatsappId?: string | null;
  name?: string | null;
}

/**
 * Encontra ou cria o contato sem duplicar (item 18).
 * Ordem de busca: wa_id -> telefone normalizado -> variantes com/sem nono digito.
 */
export async function upsertContact(
  prisma: PrismaClient,
  input: UpsertContactInput,
): Promise<{ contact: Contact; created: boolean }> {
  const e164 = normalizePhoneBR(input.phone) ?? input.phone.replace(/\D+/g, '');

  if (input.whatsappId) {
    const porWa = await prisma.contact.findFirst({
      where: { organizationId: input.organizationId, whatsappId: input.whatsappId },
    });
    if (porWa) return { contact: await completar(prisma, porWa, input, e164), created: false };
  }

  const chaves = phoneMatchKeys(e164);
  const porTelefone = await prisma.contact.findFirst({
    where: { organizationId: input.organizationId, phoneE164: { in: chaves } },
  });
  if (porTelefone) return { contact: await completar(prisma, porTelefone, input, e164), created: false };

  const contact = await prisma.contact.create({
    data: {
      organizationId: input.organizationId,
      phoneE164: e164,
      phoneRaw: input.phone,
      whatsappId: input.whatsappId ?? null,
      name: input.name ?? null,
    },
  });
  return { contact, created: true };
}

/** Preenche o que faltava sem sobrescrever informacao ja confirmada. */
async function completar(
  prisma: PrismaClient,
  contact: Contact,
  input: UpsertContactInput,
  e164: string,
): Promise<Contact> {
  const patch: Record<string, unknown> = {};
  if (!contact.whatsappId && input.whatsappId) patch.whatsappId = input.whatsappId;
  if (!contact.name && input.name) patch.name = input.name;
  if (contact.phoneE164 !== e164 && e164.length > contact.phoneE164.length) patch.phoneE164 = e164;
  if (!Object.keys(patch).length) return contact;
  return prisma.contact.update({ where: { id: contact.id }, data: patch });
}
