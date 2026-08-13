import { defineConfig, devices } from '@playwright/test';

// Configuração do teste E2E (2026-08-06) — dois propósitos ao mesmo tempo:
// 1) validar o fluxo completo como um humano usaria, clicando de verdade,
//    não chamando API direto; 2) gerar as capturas de tela que alimentam
//    docs/MANUAL_DE_USO.md — rodar o teste de novo regenera as imagens,
//    o manual nunca fica desatualizado por esquecimento.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000, // etapas com IA (análise de mercado, rascunho de campanha) demoram alguns segundos
  fullyParallel: false, // o teste é uma narrativa sequencial, não testes independentes
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
