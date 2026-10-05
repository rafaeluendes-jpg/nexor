'use client';

import { api } from './api';

export type EstadoDosAvisos = 'sem-suporte' | 'instalar-no-iphone' | 'bloqueado' | 'desligado' | 'ligado';

function base64urlParaBytes(texto: string): Uint8Array<ArrayBuffer> {
  const preenchido = (texto + '='.repeat((4 - (texto.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = window.atob(preenchido);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

function ehIphone(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function instaladoComoApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/** Em que pé estao os avisos neste aparelho. */
export async function estadoDosAvisos(): Promise<EstadoDosAvisos> {
  const suporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // No iPhone o aviso so existe com o CRM instalado na tela de inicio.
  if (ehIphone() && !instaladoComoApp()) return 'instalar-no-iphone';
  if (!suporta) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  return inscricao && Notification.permission === 'granted' ? 'ligado' : 'desligado';
}

/** Precisa ser chamado pelo toque num botao: o celular so pergunta assim. */
export async function ligarAvisos(): Promise<EstadoDosAvisos> {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desligado';

  const { chave } = await api<{ chave: string | null }>('/avisos-no-celular/chave');
  if (!chave) throw new Error('Os avisos ainda não foram ligados no servidor.');

  const reg = await registro();
  await navigator.serviceWorker.ready;
  const inscricao =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64urlParaBytes(chave) }));
  const json = inscricao.toJSON();
  await api('/avisos-no-celular', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return 'ligado';
}

/** Ao sair do CRM o aparelho para de receber: aviso e de quem esta logado. */
export async function desligarAvisos(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  if (!inscricao) return;
  await api('/avisos-no-celular/desligar', {
    method: 'POST',
    body: JSON.stringify({ endpoint: inscricao.endpoint }),
  }).catch(() => undefined);
  await inscricao.unsubscribe().catch(() => undefined);
}
