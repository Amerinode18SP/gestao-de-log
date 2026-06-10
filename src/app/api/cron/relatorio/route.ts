// ============================================================
// FREIGHT-MS — Cron Job: Verificar e enviar relatorios periodicos
// Chamado pelo GitHub Actions diariamente. Verifica todas as empresas
// e dispara o relatorio para as que estao agendadas pra hoje.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gestao-de-log.vercel.app'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Data em horario de Brasilia
  const agoraUTC = new Date()
  const offsetBrt = -3 * 60 * 60 * 1000   // BRT = UTC-3
  const agoraBrt = new Date(agoraUTC.getTime() + offsetBrt)
  const horaBrt = agoraBrt.getUTCHours()    // 0-23 (BRT)
  const diaSemana = agoraBrt.getUTCDay()    // 0=Dom, 1=Seg, ... 6=Sab
  const diaMes = agoraBrt.getUTCDate()      // 1-31

  const supabase = createSupabaseAdmin()

  // Busca empresas com config de envio (toggles independentes semanal/mensal)
  const { data: empresas, error } = await supabase
    .from('parametros_alerta')
    .select('empresa_id, emails_relatorio, envio_semanal_ativo, envio_mensal_ativo, dia_semana_envio, dia_mes_envio, hora_envio, ultimo_envio_semanal_em, ultimo_envio_mensal_em')

  if (error) {
    console.error('[cron/relatorio] erro buscar parametros:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const resultados: any[] = []
  const hojeBrtStr = agoraBrt.toISOString().slice(0, 10)

  // Helper: dispara o relatorio pra uma empresa+frequencia
  async function disparar(empresa_id: string, freq: 'Semanal' | 'Mensal', emails: string[]) {
    try {
      const r = await fetch(`${APP_URL}/api/relatorio/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id, frequencia: freq }),
      })
      const data = await r.json()
      // Marca ultimo envio da frequencia correspondente
      const campoUltimoEnvio = freq === 'Mensal' ? 'ultimo_envio_mensal_em' : 'ultimo_envio_semanal_em'
      await supabase
        .from('parametros_alerta')
        .update({ [campoUltimoEnvio]: new Date().toISOString() })
        .eq('empresa_id', empresa_id)
      resultados.push({
        empresa_id, frequencia: freq, ok: r.ok,
        enviados: (data.destinatarios ?? []).filter((d: any) => d.sent).length,
        total_destinatarios: emails.length,
        erro: r.ok ? undefined : data?.error,
      })
    } catch (e: any) {
      resultados.push({ empresa_id, frequencia: freq, ok: false, erro: e?.message })
    }
  }

  // Helper: ja enviou esta frequencia hoje?
  function jaEnviadoHoje(ts: string | null) {
    if (!ts) return false
    const ultimoBrt = new Date(new Date(ts).getTime() + offsetBrt)
    return ultimoBrt.toISOString().slice(0, 10) === hojeBrtStr
  }

  for (const cfg of (empresas ?? [])) {
    const emails = cfg.emails_relatorio ?? []
    if (!emails.length) continue

    const horaConf = cfg.hora_envio ?? 8
    // FIX: o GitHub Actions atrasa/pula execucoes, entao quase nunca cai
    // uma rodada exatamente na hora configurada. Disparamos a partir dela
    // (>=); o guard jaEnviadoHoje abaixo impede repetir no mesmo dia.
    if (horaBrt < horaConf) continue

    // --- SEMANAL ---
    if (cfg.envio_semanal_ativo && diaSemana === (cfg.dia_semana_envio ?? 1)) {
      if (jaEnviadoHoje(cfg.ultimo_envio_semanal_em)) {
        resultados.push({ empresa_id: cfg.empresa_id, frequencia: 'Semanal', ja_enviado_hoje: true })
      } else {
        await disparar(cfg.empresa_id, 'Semanal', emails)
      }
    }

    // --- MENSAL --- (pode rodar no MESMO dia se ambos coincidirem)
    if (cfg.envio_mensal_ativo && diaMes === (cfg.dia_mes_envio ?? 1)) {
      if (jaEnviadoHoje(cfg.ultimo_envio_mensal_em)) {
        resultados.push({ empresa_id: cfg.empresa_id, frequencia: 'Mensal', ja_enviado_hoje: true })
      } else {
        await disparar(cfg.empresa_id, 'Mensal', emails)
      }
    }
  }

  return NextResponse.json({
    horario_brt: `${String(diaSemana)}-${String(diaMes).padStart(2, '0')} ${String(horaBrt).padStart(2, '0')}:00`,
    empresas_avaliadas: empresas?.length ?? 0,
    empresas_disparadas: resultados.length,
    resultados,
  })
}
