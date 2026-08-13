-- JWT + perfis (2026-08-05, decisão do usuário — reverte a decisão anterior de
-- single-user, seção 10 item 3 do doc de arquitetura, registrada como revisada
-- ali). A tabela `users` já existia desde a migration 001 (nunca usada) —
-- só falta o que o fluxo de login/perfil precisa.

ALTER TABLE users
  ADD COLUMN name TEXT,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Perfis usados (texto livre, mesmo padrão de status em outras tabelas do
-- projeto — sem enum rígido): 'administrador', 'gerente', 'operador', 'visualizador'.
-- Hierarquia de permissão vive em código (shared/auth/middleware.js#ROLE_RANK),
-- não no banco.
