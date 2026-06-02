-- ============================================================
-- Tabela: convites
-- Códigos curtos próprios usados como camada intermediária no
-- fluxo de convite por email. Resolve o problema de "Safe Links"
-- (Yahoo/Outlook/Gmail corporativo) pré-clicarem links e
-- consumirem tokens one-time do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS convites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT UNIQUE NOT NULL,             -- string aleatória longa, vai no link
  email         TEXT NOT NULL,
  nome          TEXT NOT NULL,
  papel         TEXT NOT NULL,
  empresa_id    UUID NOT NULL,
  user_id       UUID,                              -- auth.users.id da pessoa convidada
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  usado_em      TIMESTAMPTZ,                       -- NULL = ainda não usado
  invalidado_em TIMESTAMPTZ                        -- NULL = ainda válido (admin pode invalidar)
);

CREATE INDEX IF NOT EXISTS idx_convites_codigo  ON convites(codigo);
CREATE INDEX IF NOT EXISTS idx_convites_email   ON convites(email);
CREATE INDEX IF NOT EXISTS idx_convites_empresa ON convites(empresa_id);

-- RLS: somente service_role (backend) pode ler/escrever
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;
