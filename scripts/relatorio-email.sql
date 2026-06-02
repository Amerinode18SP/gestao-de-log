-- ============================================================
-- Adiciona campos para configurar envio de relatorio por email
-- na tabela parametros_alerta (uma linha por empresa).
-- ============================================================

ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS emails_relatorio TEXT[]   DEFAULT ARRAY[]::TEXT[];
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS frequencia_envio TEXT     DEFAULT 'Semanal';   -- 'Semanal' | 'Mensal'
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS dia_semana_envio INTEGER  DEFAULT 1;            -- 0=Dom, 1=Seg, ... 6=Sab
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS dia_mes_envio INTEGER     DEFAULT 1;            -- 1-28
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS hora_envio INTEGER        DEFAULT 8;            -- 0-23, hora local Sao Paulo
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS ultimo_envio_em TIMESTAMPTZ;

-- Indice pra cron consultar empresas pra enviar hoje
CREATE INDEX IF NOT EXISTS idx_parametros_alerta_envio
  ON parametros_alerta(frequencia_envio, dia_semana_envio, dia_mes_envio);
