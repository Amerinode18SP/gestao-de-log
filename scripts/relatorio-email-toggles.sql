-- ============================================================
-- Toggles independentes para envio semanal e mensal de relatorio.
-- Antes a config era unica (frequencia_envio = Semanal OU Mensal).
-- Agora podem coexistir: empresa pode ter SO semanal, SO mensal,
-- ambos ou nenhum, com dias separados.
-- ============================================================

ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS envio_semanal_ativo BOOLEAN DEFAULT FALSE;
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS envio_mensal_ativo  BOOLEAN DEFAULT FALSE;

-- Controle separado de duplicidade pra nao enviar 2x no mesmo dia
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS ultimo_envio_semanal_em TIMESTAMPTZ;
ALTER TABLE parametros_alerta ADD COLUMN IF NOT EXISTS ultimo_envio_mensal_em  TIMESTAMPTZ;

-- Migra dados antigos: quem ja tinha frequencia configurada, ativa o respectivo toggle
UPDATE parametros_alerta
   SET envio_semanal_ativo = TRUE
 WHERE frequencia_envio = 'Semanal'
   AND COALESCE(array_length(emails_relatorio, 1), 0) > 0;

UPDATE parametros_alerta
   SET envio_mensal_ativo = TRUE
 WHERE frequencia_envio = 'Mensal'
   AND COALESCE(array_length(emails_relatorio, 1), 0) > 0;

-- ultimo_envio_em vira retrocompativel pro ultimo envio realizado, qualquer um
UPDATE parametros_alerta
   SET ultimo_envio_semanal_em = ultimo_envio_em
 WHERE frequencia_envio = 'Semanal' AND ultimo_envio_em IS NOT NULL;

UPDATE parametros_alerta
   SET ultimo_envio_mensal_em = ultimo_envio_em
 WHERE frequencia_envio = 'Mensal' AND ultimo_envio_em IS NOT NULL;
