-- ============================================================
-- SERVIÇOS — Frete / Coleta / Motoboy
-- Recebe os lançamentos das planilhas de fechamento (mensal)
-- e de conferência (semanal). Tabela única, com coluna `tipo`.
-- ============================================================
create table if not exists servicos (
  id                 uuid primary key default uuid_generate_v4(),
  empresa_id         uuid references empresas(id) on delete cascade,

  -- Classificação (definida na importação; editável na tela)
  tipo               text check (tipo in ('Frete','Coleta','Motoboy')) not null default 'Motoboy',
  origem_planilha    text,   -- 'Fechamento' | 'Conferencia' | 'Manual'

  -- Identificação / contexto
  os_controle        text,   -- OS (fechamento) | Controle (conferência)
  base               text,
  cliente            text,
  solicitante        text,
  aprovacao          text,
  colaborador        text,

  -- Datas / período
  data_servico       date,
  hora_saida         text,   -- 'HH:MM'
  periodo            text,   -- Diurno/Noturno
  fds_feriado        boolean default false,
  capital_interior   text,
  mes_referencia     text,   -- 'YYYY-MM'
  semana_referencia  text,

  veiculo            text,

  -- Origem
  origem_endereco    text,
  origem_bairro      text,
  origem_cidade      text,
  origem_uf          char(2),
  origem_cep         text,

  -- Destino
  destino_endereco   text,
  destino_bairro     text,
  destino_cidade     text,
  destino_uf         char(2),
  destino_cep        text,
  destino_descricao  text,   -- rota resumida (BASE STS) / texto longo

  -- Quilometragem
  distancia_km       numeric(10,2),
  km_faturado        numeric(10,2),
  km_adicional       numeric(10,2),
  valor_km           numeric(12,2),
  valor_minimo       numeric(12,2),

  -- Valores
  pedagios           numeric(12,2),
  tempo_espera       text,
  valor_espera       numeric(12,2),
  adicional_noturno  numeric(12,2),
  adicional_fds      numeric(12,2),
  outras_cobrancas   numeric(12,2),
  valor_total        numeric(12,2),

  -- Volume
  quantidade         integer default 1,
  chamados           text,

  -- Entrega / SLA
  status             text,
  data_entrega       date,
  hora_entrega       text,
  recebedor          text,
  tempo_execucao     text,
  tempo_limite       text,
  sla                text,
  retorno            boolean default false,

  observacao         text,

  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now()
);

create index if not exists idx_servicos_empresa_id   on servicos(empresa_id);
create index if not exists idx_servicos_tipo         on servicos(tipo);
create index if not exists idx_servicos_data_servico on servicos(data_servico);
create index if not exists idx_servicos_mes_ref      on servicos(mes_referencia);
create index if not exists idx_servicos_base         on servicos(base);

-- atualizado_em automático (reusa a função set_atualizado_em do schema inicial)
drop trigger if exists trg_servicos_atualizado_em on servicos;
create trigger trg_servicos_atualizado_em
  before update on servicos
  for each row execute function set_atualizado_em();

-- RLS por empresa (mesmo padrão das demais tabelas)
alter table servicos enable row level security;

drop policy if exists "empresa_isolation" on servicos;
create policy "empresa_isolation" on servicos
  using (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
