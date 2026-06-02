// ============================================================
// FREIGHT-MS — API Route: POST /api/relatorio/enviar
// Gera o relatorio do periodo e envia para a lista de emails.
// Pode ser chamado:
//   - manualmente da tela de Configuracoes ("Enviar teste agora")
//   - automaticamente pelo cron diario quando hoje for o dia configurado
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { enviarEmail, templateRelatorio } from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gestao-de-log.vercel.app'

function fmtBR(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export async function POST(req: NextRequest) {
  try {
    const { empresa_id, frequencia, emails_override } = await req.json()
    if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

    const supabase = createSupabaseAdmin()

    // 1. Pega parametros (lista de emails + frequencia configurada)
    const { data: params, error: pErr } = await supabase
      .from('parametros_alerta')
      .select('*')
      .eq('empresa_id', empresa_id)
      .maybeSingle()
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    const freq = (frequencia ?? params?.frequencia_envio ?? 'Semanal') as 'Semanal' | 'Mensal'
    const emails: string[] = (emails_override ?? params?.emails_relatorio ?? []).filter(Boolean)

    if (!emails.length) {
      return NextResponse.json({ error: 'Nenhum email cadastrado para receber o relatorio' }, { status: 400 })
    }

    // 2. Define janela de datas
    const hoje = new Date()
    const ini = new Date(hoje)
    if (freq === 'Mensal') {
      ini.setMonth(hoje.getMonth() - 1)
    } else {
      ini.setDate(hoje.getDate() - 7)
    }
    const iniStr = ini.toISOString().slice(0, 10)
    const hojeStr = hoje.toISOString().slice(0, 10)
    const periodoLabel = freq === 'Mensal'
      ? `Relatório mensal — ${fmtBR(ini)} a ${fmtBR(hoje)}`
      : `Relatório semanal — ${fmtBR(ini)} a ${fmtBR(hoje)}`

    // 3. Agrega dados do período (KPIs e ranking)
    const { data: ctes } = await supabase
      .from('ctes')
      .select('id, status, valor_servico, fornecedor_id, centro_custo_id, centro_custo_nome, fornecedor:fornecedores(nome), centro_custo:centros_custo(nome)')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', iniStr)
      .lte('data_emissao', hojeStr)

    const totalGasto = (ctes ?? []).reduce((s, c: any) => s + (c.valor_servico ?? 0), 0)
    const qtd        = ctes?.length ?? 0
    const ticketMedio = qtd > 0 ? totalGasto / qtd : 0

    // Top transportadoras
    const fornMap = new Map<string, { nome: string; valor: number; ctes: number }>()
    ;(ctes ?? []).forEach((c: any) => {
      const id = c.fornecedor_id
      if (!id) return
      const nome = c.fornecedor?.nome ?? id
      const atual = fornMap.get(id) ?? { nome, valor: 0, ctes: 0 }
      fornMap.set(id, { nome, valor: atual.valor + (c.valor_servico ?? 0), ctes: atual.ctes + 1 })
    })
    const porTransportadora = [...fornMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 10)

    // Top centros de custo
    const centroMap = new Map<string, { nome: string; valor: number }>()
    ;(ctes ?? []).forEach((c: any) => {
      const nome = c.centro_custo?.nome ?? c.centro_custo_nome ?? 'Sem centro'
      const atual = centroMap.get(nome) ?? { nome, valor: 0 }
      centroMap.set(nome, { nome, valor: atual.valor + (c.valor_servico ?? 0) })
    })
    const porCentroCusto = [...centroMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 10)

    // 4. Comparativo dos últimos 6 meses (ano-mês x total)
    const inicio6m = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)
    const inicio6mStr = inicio6m.toISOString().slice(0, 10)
    const { data: ctesUltimos6m } = await supabase
      .from('ctes')
      .select('valor_servico, data_emissao')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', inicio6mStr)
      .lte('data_emissao', hojeStr)

    const nomesMes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
    const gastosPorMes: { label: string; valor: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const ano = d.getFullYear(), mes = d.getMonth()
      const chave = `${ano}-${String(mes + 1).padStart(2, '0')}`
      const total = (ctesUltimos6m ?? []).filter((r: any) => String(r.data_emissao).slice(0, 7) === chave).reduce((s, r: any) => s + (r.valor_servico ?? 0), 0)
      gastosPorMes.push({ label: `${nomesMes[mes]}/${String(ano).slice(2)}`, valor: total })
    }
    const mediaMensal = gastosPorMes.length > 0
      ? gastosPorMes.reduce((s, m) => s + m.valor, 0) / gastosPorMes.filter(m => m.valor > 0).length || 0
      : 0

    // 5. Renderiza template visual
    const html = templateRelatorio({
      periodoLabel,
      totalGasto,
      mediaMensal,
      totalCtes: qtd,
      ticketMedio,
      gastosPorMes,
      porTransportadora,
      porCentroCusto,
    })

    // 6. Envia para todos os emails (uma chamada Resend por destinatario)
    const resultados: any[] = []
    for (const to of emails) {
      const r = await enviarEmail({
        to,
        subject: `${periodoLabel} — ${totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        html,
      })
      resultados.push({ to, ...r })
    }

    // 6. Marca ultimo envio
    if (!emails_override) {
      await supabase
        .from('parametros_alerta')
        .update({ ultimo_envio_em: new Date().toISOString() })
        .eq('empresa_id', empresa_id)
    }

    return NextResponse.json({
      ok: true,
      periodo: { inicio: iniStr, fim: hojeStr, freq },
      total_kpi: totalGasto,
      destinatarios: resultados,
    })
  } catch (e: any) {
    console.error('[relatorio/enviar]', e)
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
