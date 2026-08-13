import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Teste E2E de ponta a ponta (2026-08-06) — clica de verdade no navegador,
// como um humano usaria, em vez de chamar a API direto. Cada test.step()
// tira 1 screenshot nomeado — essas imagens alimentam docs/MANUAL_DE_USO.md.
// Rodar de novo regenera as imagens; o manual nunca fica desatualizado.
//
// Requer: API rodando (npm start) e frontend rodando (npm run dev) ANTES de
// rodar este teste — ele não sobe os servidores sozinho.
//
// Algumas etapas chamam IA de verdade (análise de mercado, rascunho de
// campanha) — isso tem custo real na conta Anthropic e leva alguns segundos.
// Rodar esse teste não é gratuito nem instantâneo — não vira parte de um CI
// que roda a cada commit sem pensar nisso.

const SCREENSHOT_DIR = path.join(process.cwd(), '..', '..', 'docs', 'manual-screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let shotCounter = 0;
async function shot(page, name) {
  shotCounter++;
  const filename = `${String(shotCounter).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
}

function field(page, labelText) {
  return page.locator('.field').filter({ hasText: labelText }).locator('input, select, textarea').first();
}

const TEST_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-teste@example.com';
const TEST_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'SenhaDeTesteE2E123!';
const PRODUCT_NAME = `Produto Teste E2E ${Date.now()}`;

test('jornada completa de um usuário real na plataforma', async ({ page }) => {
  await test.step('Login (ou primeiro acesso)', async () => {
    await page.goto('/');
    await shot(page, 'tela-de-login');

    const isBootstrap = await page.getByText('Primeiro acesso').isVisible().catch(() => false);
    if (isBootstrap) {
      await page.locator('#name').fill('Usuário de Teste E2E');
      await page.locator('#email').fill(TEST_EMAIL);
      await page.locator('#password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Criar conta de administrador' }).click();
    } else {
      await page.locator('#email').fill(TEST_EMAIL);
      await page.locator('#password').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Entrar' }).click();
    }
    await expect(page.getByText('Visão geral')).toBeVisible({ timeout: 10_000 });
  });

  await test.step('Dashboard — visão geral', async () => {
    await shot(page, 'dashboard-visao-geral');
  });

  await test.step('Cadastrar um produto novo', async () => {
    // Escopo .nav-links: os KPIs do Dashboard também são <a> e colidem com
    // getByRole('link', { name: 'Produtos'|'Alertas'|... }) em strict mode.
    const nav = page.locator('.nav-links');
    await nav.getByRole('link', { name: 'Produtos', exact: true }).click();
    await shot(page, 'produtos-lista-vazia-ou-existente');

    await page.getByRole('button', { name: '+ Adicionar produto' }).click();
    await shot(page, 'modal-cadastro-produto');

    await field(page, 'Nome do produto').fill(PRODUCT_NAME);
    await field(page, 'Rede').fill('digistore24');
    await field(page, 'Comissão por venda').fill('50');
    await field(page, 'Taxa de conversão esperada').fill('7');
    await shot(page, 'preview-economics-ao-vivo');

    await page.getByRole('button', { name: 'Cadastrar produto' }).click();
    await expect(page.getByText(PRODUCT_NAME)).toBeVisible({ timeout: 15_000 });
    await shot(page, 'produto-cadastrado-na-lista');
  });

  await test.step('Ver análise de mercado do produto', async () => {
    await page.locator('.nav-links').getByRole('link', { name: 'Mercado', exact: true }).click();
    await shot(page, 'mercado-lista-produtos');

    await page.getByText(PRODUCT_NAME).click();
    await shot(page, 'modal-analise-mercado-antes');

    const analyzeBtn = page.getByRole('button', { name: /Analisar oportunidade|Reanalisar/ });
    await analyzeBtn.click();
    await expect(page.getByText(/Vale anunciar|Não vale anunciar/)).toBeVisible({ timeout: 90_000 });
    await shot(page, 'modal-analise-mercado-resultado');
    // Fecha o modal antes de navegar — senão o overlay intercepta cliques na nav.
    await page.locator('.modal-close').click();
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
  });

  await test.step('Rascunho de campanha', async () => {
    await page.locator('.nav-links').getByRole('link', { name: 'Rascunhos de Campanha', exact: true }).click();
    await shot(page, 'rascunhos-lista');

    await page.getByRole('button', { name: '+ Novo rascunho' }).click();
    await field(page, 'Produto').selectOption({ label: PRODUCT_NAME });
    const draftName = `Campanha Teste E2E ${Date.now()}`;
    await field(page, 'Nome da campanha').fill(draftName);
    await field(page, 'Orçamento diário').fill('30');
    await shot(page, 'modal-novo-rascunho-preenchido');

    await page.getByRole('button', { name: 'Gerar rascunho' }).click();
    // Espera o modal fechar e o rascunho novo aparecer na lista (não getByText('Rascunho') —
    // esse texto já existe em vários lugares e dispara strict mode).
    await expect(page.getByText(draftName)).toBeVisible({ timeout: 120_000 });
    await shot(page, 'rascunho-gerado');
  });

  await test.step('Concorrência', async () => {
    await page.locator('.nav-links').getByRole('link', { name: 'Concorrência', exact: true }).click();
    await shot(page, 'concorrencia-lista');
  });

  await test.step('Contas e Governança — árvore e heatmap', async () => {
    await page.locator('.nav-links').getByRole('link', { name: 'Contas', exact: true }).click();
    await shot(page, 'contas-arvore');

    await page.getByRole('button', { name: 'Heatmap' }).click();
    await shot(page, 'contas-heatmap');

    await page.getByRole('button', { name: 'Tabela' }).click();
    await shot(page, 'contas-tabela');
  });

  await test.step('Alertas', async () => {
    await page.locator('.nav-links').getByRole('link', { name: 'Alertas', exact: true }).click();
    await shot(page, 'alertas-lista');
  });

  console.log(`\n${shotCounter} screenshots salvos em: ${SCREENSHOT_DIR}\n`);
});
