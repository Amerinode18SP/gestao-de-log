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
    //    Semanal: ultima semana fechada (segunda anterior a domingo anterior).
    //    Mensal: mesmo intervalo de hoje 1 mes atras ate hoje.
    const hoje = new Date()
    let ini: Date
    let fim: Date
    if (freq === 'Mensal') {
      ini = new Date(hoje); ini.setMonth(hoje.getMonth() - 1)
      fim = new Date(hoje)
    } else {
      // Quero a semana fechada anterior: segunda passada ate domingo passado.
      // getDay: 0=Dom, 1=Seg, 2=Ter, ... 6=Sab.
      const dow = hoje.getDay()
      // Diferença ate o ULTIMO domingo (1 se hoje for segunda, 7 se for domingo, ...)
      const diasAteDomingoAnterior = dow === 0 ? 7 : dow
      fim = new Date(hoje); fim.setDate(hoje.getDate() - diasAteDomingoAnterior)
      ini = new Date(fim); ini.setDate(fim.getDate() - 6)  // segunda da mesma semana = domingo - 6
    }
    const iniStr = ini.toISOString().slice(0, 10)
    const hojeStr = fim.toISOString().slice(0, 10)
    const periodoLabel = freq === 'Mensal'
      ? `Relatório mensal — ${fmtBR(ini)} a ${fmtBR(fim)}`
      : `Relatório semanal — ${fmtBR(ini)} a ${fmtBR(fim)}`

    // 3. Helper que pagina e usa os MESMOS filtros do /api/ctes/resumo
    //    (que eh quem alimenta o dashboard que a Ana valida com Omie):
    //      - chave_acesso real (nao null, nao 'omie-X')
    //      - tudo EXCETO Cancelado
    //    Pagina ate 20k linhas pra nunca truncar.
    async function fetchAll<T>(queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
      const PAGE = 1000
      const acc: T[] = []
      let from = 0
      while (from < 20000) {
        const { data } = await queryFn(from, from + PAGE - 1)
        if (!data || !data.length) break
        acc.push(...data)
        if (data.length < PAGE) break
        from += PAGE
      }
      return acc
    }

    // 4. Dados do período (KPIs e ranking)
    const ctes = await fetchAll<any>((f, t) => supabase
      .from('ctes')
      .select('id, status, valor_servico, fornecedor_id, centro_custo_id, centro_custo_nome, fornecedor:fornecedores(nome), centro_custo:centros_custo(nome)')
      .eq('empresa_id', empresa_id)
      .not('chave_acesso', 'is', null)
      .not('chave_acesso', 'ilike', 'omie-%')
      .neq('status', 'Cancelado')
      .gte('data_emissao', iniStr)
      .lte('data_emissao', hojeStr)
      .range(f, t))

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

    // 5. Comparativo ANUAL — janeiro até mês corrente do ano vigente
    const inicioAno = `${hoje.getFullYear()}-01-01`
    const ctesAno = await fetchAll<any>((f, t) => supabase
      .from('ctes')
      .select('valor_servico, data_emissao')
      .eq('empresa_id', empresa_id)
      .not('chave_acesso', 'is', null)
      .not('chave_acesso', 'ilike', 'omie-%')
      .neq('status', 'Cancelado')
      .gte('data_emissao', inicioAno)
      .lte('data_emissao', hojeStr)
      .range(f, t))

    const nomesMes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
    const gastosAnual: { label: string; valor: number }[] = []
    for (let m = 0; m <= hoje.getMonth(); m++) {
      const chave = `${hoje.getFullYear()}-${String(m + 1).padStart(2, '0')}`
      const total = (ctesAno ?? []).filter((r: any) => String(r.data_emissao).slice(0, 7) === chave)
        .reduce((s, r: any) => s + (r.valor_servico ?? 0), 0)
      gastosAnual.push({ label: `${nomesMes[m]}/${String(hoje.getFullYear()).slice(2)}`, valor: total })
    }
    const mesesAtivos = gastosAnual.filter(m => m.valor > 0).length
    const mediaMensal = mesesAtivos > 0
      ? gastosAnual.reduce((s, m) => s + m.valor, 0) / mesesAtivos
      : 0

    // 6. Distribuição POR DIA DA SEMANA — últimos 30 dias
    const inicio30d = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
    const inicio30dStr = inicio30d.toISOString().slice(0, 10)
    const ctesUltimos30 = await fetchAll<any>((f, t) => supabase
      .from('ctes')
      .select('valor_servico, data_emissao')
      .eq('empresa_id', empresa_id)
      .not('chave_acesso', 'is', null)
      .not('chave_acesso', 'ilike', 'omie-%')
      .neq('status', 'Cancelado')
      .gte('data_emissao', inicio30dStr)
      .lte('data_emissao', hojeStr)
      .range(f, t))

    const nomesDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const porDiaSemana: { label: string; valor: number }[] = []
    for (let d = 1; d <= 5; d++) {  // segunda (1) a sexta (5) — comercial
      let total = 0
      ;(ctesUltimos30 ?? []).forEach((r: any) => {
        if (!r.data_emissao) return
        const dt = new Date(r.data_emissao + 'T12:00:00')   // meio-dia evita borda timezone
        if (dt.getDay() === d) total += r.valor_servico ?? 0
      })
      porDiaSemana.push({ label: nomesDia[d], valor: total })
    }

    // 6. Renderiza template visual
    const html = templateRelatorio({
      periodoLabel,
      totalGasto,
      mediaMensal,
      totalCtes: qtd,
      ticketMedio,
      gastosAnual,
      porDiaSemana,
      mesAtualLabel: `últimos 30 dias`,
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
