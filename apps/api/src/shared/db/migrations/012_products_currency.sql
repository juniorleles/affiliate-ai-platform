-- Bug real encontrado em 2026-08-04: nenhuma tabela rastreava moeda. commissionValue
-- e cpcLeilao estavam sendo comparados como se fossem sempre a mesma unidade —
-- não são. Ver docs/ARQUITETURA.md para o relato completo do incidente.

ALTER TABLE products
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'; -- moeda em que price/commission_value estão

-- Para os produtos já cadastrados (Digistore24, telas mostravam € explicitamente),
-- o DEFAULT 'EUR' acima já preenche corretamente os registros existentes.
