-- ============================================================
-- SERVIÇOS — coluna fornecedor
-- Nome do fornecedor (transportadora/prestador), preenchido na
-- importação (aplicado a todas as linhas) ou manualmente.
-- ============================================================
alter table servicos add column if not exists fornecedor text;

create index if not exists idx_servicos_fornecedor on servicos(fornecedor);
