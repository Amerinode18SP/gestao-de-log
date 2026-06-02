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

  // Busca empresas com config de envio
  const { data: empresas, error } = await supabase
    .from('parametros_alerta')
    .select('empresa_id, emails_relatorio, frequencia_envio, dia_semana_envio, dia_mes_envio, hora_envio, ultimo_envio_em')

  if (error) {
    console.error('[cron/relatorio] erro buscar parametros:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const resultados: any[] = []

  for (const cfg of (empresas ?? [])) {
    const emails = cfg.emails_relatorio ?? []
    if (!emails.length) continue                                 // sem destinatarios

    // Match de dia + hora
    const horaConf = cfg.hora_envio ?? 8
    if (horaBrt !== horaConf) continue                            // hora errada

    let agendado = false
    if (cfg.frequencia_envio === 'Mensal') {
      agendado = diaMes === (cfg.dia_mes_envio ?? 1)
    } else {
      // Semanal (default)
      agendado = diaSemana === (cfg.dia_semana_envio ?? 1)
    }
    if (!agendado) continue

    // Evita re-envio se ja foi enviado hoje (proteção contra cron disparar 2x)
    if (cfg.ultimo_envio_em) {
      const ultimoBrt = new Date(new Date(cfg.ultimo_envio_em).getTime() + offsetBrt)
      if (ultimoBrt.toISOString().slice(0, 10) === agoraBrt.toISOString().slice(0, 10)) {
        resultados.push({ empresa_id: cfg.empresa_id, ja_enviado_hoje: true })
        continue
      }
    }

    // Dispara envio
    try {
      const r = await fetch(`${APP_URL}/api/relatorio/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: cfg.empresa_id, frequencia: cfg.frequencia_envio }),
      })
      const data = await r.json()
      resultados.push({
        empresa_id: cfg.empresa_id,
        ok: r.ok,
        enviados: (data.destinatarios ?? []).filter((d: any) => d.sent).length,
        total_destinatarios: emails.length,
        erro: r.ok ? undefined : data?.error,
      })
    } catch (e: any) {
      resultados.push({ empresa_id: cfg.empresa_id, ok: false, erro: e?.message })
    }
  }

  return NextResponse.json({
    horario_brt: `${String(diaSemana)}-${String(diaMes).padStart(2, '0')} ${String(horaBrt).padStart(2, '0')}:00`,
    empresas_avaliadas: empresas?.length ?? 0,
    empresas_disparadas: resultados.length,
    resultados,
  })
}
