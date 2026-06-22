-- SERVICOS - limpeza de duplicados ja gravados (one-time)
-- Duplicado = MESMO chamado (nao vazio) E MESMO horario (hora_saida)
--   E MESMO OS/Controle (os_controle) -- cada um igual ou ambos vazios --
--   E pelo menos 2 de: fornecedor, data_servico, valor_total.
-- (>= 3 dos 4 campos, sempre incluindo o chamado; horario e OS/Controle
--  separam servicos que repetem o mesmo chamado.) Vazio/NULL nao conta.
-- Mantem 1 registro por grupo (menor id) e apaga os demais.
-- Rode o PASSO 1 (preview) e so depois o PASSO 2 (delete).

-- PASSO 1: PREVIEW (nao apaga nada)
select a.id, a.fornecedor, a.data_servico, a.hora_saida, a.os_controle, a.chamados, a.valor_total, a.tipo
from servicos a
where exists (
  select 1 from servicos b
  where b.empresa_id = a.empresa_id
    and b.id < a.id
    and nullif(trim(a.chamados), '') = nullif(trim(b.chamados), '')
    and nullif(trim(a.hora_saida), '')   is not distinct from nullif(trim(b.hora_saida), '')
    and nullif(trim(a.os_controle), '')  is not distinct from nullif(trim(b.os_controle), '')
    and ( coalesce((nullif(trim(a.fornecedor), '') = nullif(trim(b.fornecedor), ''))::int, 0)
        + coalesce((a.data_servico = b.data_servico)::int, 0)
        + coalesce((a.valor_total = b.valor_total)::int, 0) ) >= 2
)
order by a.fornecedor, a.data_servico, a.chamados;

-- PASSO 2: DELETE (apaga, mantendo o menor id de cada grupo)
delete from servicos a
where exists (
  select 1 from servicos b
  where b.empresa_id = a.empresa_id
    and b.id < a.id
    and nullif(trim(a.chamados), '') = nullif(trim(b.chamados), '')
    and nullif(trim(a.hora_saida), '')   is not distinct from nullif(trim(b.hora_saida), '')
    and nullif(trim(a.os_controle), '')  is not distinct from nullif(trim(b.os_controle), '')
    and ( coalesce((nullif(trim(a.fornecedor), '') = nullif(trim(b.fornecedor), ''))::int, 0)
        + coalesce((a.data_servico = b.data_servico)::int, 0)
        + coalesce((a.valor_total = b.valor_total)::int, 0) ) >= 2
);
