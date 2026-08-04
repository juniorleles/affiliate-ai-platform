# Plataforma Privada de IA para Marketing de Afiliados

Monorepo. Arquitetura completa em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — leia
antes de mexer em qualquer coisa estrutural.

## Estado atual (o que já roda de verdade)

- **Fase 0** (infra + affiliate-ops migrado pra Postgres): ✅ completo
- **Fase 1** (Google Ads + Monitoring): ✅ completo
- **Fases 2-4** (Discovery, Market Intelligence, Competitive Intelligence): stubs
  estruturados, aguardando as decisões da seção 9 do documento de arquitetura

## Como rodar

### 1. Suba a infra (Postgres, Redis, n8n)

```bash
cp .env.example .env    # edite ADMIN_KEY, JWT_SECRET, senha do Postgres
npm run infra:up
```

### 2. Instale as dependências e rode as migrations

```bash
npm install
npm run migrate
```

### 3. Rode a API e o worker (em terminais separados)

```bash
npm run dev:api      # API HTTP, porta 3000
npm run --workspace=apps/api worker    # processa a fila (sync, análise de IA, monitoramento)
```

### 4. Rode o frontend

```bash
npm run dev:web       # http://localhost:5173
```

## Testes

```bash
npm test   # roda os testes unitários da API (node --test, sem dependência extra)
```

## Ordem de implementação

Ver `docs/ARQUITETURA.md` seção 8 (roadmap por fases) e seção 9 (decisões que precisam
da sua confirmação antes de começar a Fase 2 em diante — fonte de dado de inteligência
competitiva, split Claude/OpenAI, single/multi-user, hospedagem).

## Estrutura

```
affiliate-ai-platform/
├── apps/
│   ├── api/     # backend Node.js — ver apps/api/src/modules/*
│   └── web/     # frontend React — ver apps/web/src/features/*
├── infra/       # docker-compose (Postgres, Redis, n8n)
├── workflows/   # exports .json dos workflows do n8n
├── docs/
│   └── ARQUITETURA.md
└── .cursor/rules/
```
