import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const CHROMIUM_PADRAO = '/opt/pw-browsers/chromium';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? (existsSync(CHROMIUM_PADRAO) ? CHROMIUM_PADRAO : undefined);

/**
 * Provas de ponta a ponta da Fase 1.
 *
 * Os servicos ja precisam estar de pe (docker compose ou os scripts de dev).
 * A landing de teste sobe numa porta propria, com um numero de WhatsApp
 * ficticio, para provar o link do botao sem inventar credencial de producao.
 */
export const PORTAS = {
  landing: Number(process.env.E2E_LANDING_PORT ?? 3000),
  landingComNumero: Number(process.env.E2E_LANDING_WA_PORT ?? 3010),
  crm: Number(process.env.E2E_CRM_PORT ?? 3001),
  api: Number(process.env.E2E_API_PORT ?? 3333),
};

// "localhost" e nao "127.0.0.1": e o nome que esta na lista de origens
// permitidas da API (CORS_ALLOWED_ORIGINS). Origem diferente, navegador barra.
export const URLS = {
  landing: `http://localhost:${PORTAS.landing}`,
  landingComNumero: `http://localhost:${PORTAS.landingComNumero}`,
  crm: `http://localhost:${PORTAS.crm}`,
  api: `http://localhost:${PORTAS.api}`,
};

/** Numero ficticio, so para o teste do link. Nunca vai para producao. */
export const NUMERO_DE_TESTE = '5517999990000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: '../var/playwright-report', open: 'never' }]],
  outputDir: '../var/playwright-results',
  use: {
    baseURL: URLS.landing,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Chromium ja instalado na maquina; evita baixar navegador a cada execucao.
    launchOptions: { executablePath: CHROMIUM },
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] }, testMatch: /landing\.spec\.ts/ },
  ],
});
