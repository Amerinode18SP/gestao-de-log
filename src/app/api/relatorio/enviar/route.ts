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
    //    Mensal: mes fechado anterior (dia 01 ao ultimo dia do mes anterior).
    const hoje = new Date()
    let ini: Date
    let fim: Date
    if (freq === 'Mensal') {
      // Mes fechado anterior. Ex: hoje 03/06/26 -> 01/05/26 a 31/05/26.
      ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)  // dia 0 do mes atual = ult dia mes anterior
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
    const fimStr = fim.toISOString().slice(0, 10)  // FIM do periodo do relatorio
    const hojeStr = hoje.toISOString().slice(0, 10)  // HOJE de verdade (pra grafico mes atual)
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
      .select('id, status, valor_servico, data_emissao, fornecedor_id, centro_custo_id, centro_custo_nome, fornecedor:fornecedores(nome), centro_custo:centros_custo(nome)')
      .eq('empresa_id', empresa_id)
      .not('chave_acesso', 'is', null)
      .not('chave_acesso', 'ilike', 'omie-%')
      .neq('status', 'Cancelado')
      .gte('data_emissao', iniStr)
      .lte('data_emissao', fimStr)
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
    const totalAno = gastosAnual.reduce((s, m) => s + m.valor, 0)
    const mesesAtivos = gastosAnual.filter(m => m.valor > 0).length
    const mediaMensal = mesesAtivos > 0 ? totalAno / mesesAtivos : 0

    const nomesMesCurto = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
    const nomesMesLong  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

    // 4.5. Calcula o CARD COMPARATIVO 2 (depende da frequencia):
    //   Semanal: "Mes atual ate hoje" (01 ate hoje)
    //   Mensal:  "Mes anterior" ao mes do relatorio (ex: relat Maio -> card Abril)
    let totalSegundoCard: number
    let labelSegundoCard: string
    let ctesMesAtualParaGrafico: any[] = []  // pego no ramo semanal pra reusar no grafico
    if (freq === 'Mensal') {
      // Mes anterior ao mes do relatorio (ini = primeiro dia do mes do relat).
      const iniMesAnt = new Date(ini.getFullYear(), ini.getMonth() - 1, 1)
      const fimMesAnt = new Date(ini.getFullYear(), ini.getMonth(), 0)
      const iniMesAntStr = iniMesAnt.toISOString().slice(0, 10)
      const fimMesAntStr = fimMesAnt.toISOString().slice(0, 10)
      const ctesMesAnt = await fetchAll<any>((f, t) => supabase
        .from('ctes')
        .select('valor_servico')
        .eq('empresa_id', empresa_id)
        .not('chave_acesso', 'is', null)
        .not('chave_acesso', 'ilike', 'omie-%')
        .neq('status', 'Cancelado')
        .gte('data_emissao', iniMesAntStr)
        .lte('data_emissao', fimMesAntStr)
        .range(f, t))
      totalSegundoCard = ctesMesAnt.reduce((s: number, r: any) => s + (r.valor_servico ?? 0), 0)
      labelSegundoCard = `${nomesMesLong[iniMesAnt.getMonth()]}/${iniMesAnt.getFullYear()} (mês anterior)`
    } else {
      // Semanal:
      //   Card 2 = mes ATUAL ate hoje (ex jun/26 ate hoje, mesmo que pouco).
      //   Grafico semanas = mes fechado ANTERIOR (ex Maio inteiro), pra sempre ter
      //   dado real e dar contexto a semana do relatorio.
      const inicioMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
      const ctesMesAtual = await fetchAll<any>((f, t) => supabase
        .from('ctes')
        .select('valor_servico')
        .eq('empresa_id', empresa_id)
        .not('chave_acesso', 'is', null)
        .not('chave_acesso', 'ilike', 'omie-%')
        .neq('status', 'Cancelado')
        .gte('data_emissao', inicioMesAtual)
        .lte('data_emissao', hojeStr)
        .range(f, t))
      totalSegundoCard = ctesMesAtual.reduce((s: number, r: any) => s + (r.valor_servico ?? 0), 0)
      labelSegundoCard = `${nomesMesCurto[hoje.getMonth()]}/${String(hoje.getFullYear()).slice(2)} até hoje`

      // Grafico de semanas: mes fechado anterior (Maio quando hoje e Jun)
      const inicioMesAntStr = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10)
      const fimMesAntStr = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10)
      ctesMesAtualParaGrafico = await fetchAll<any>((f, t) => supabase
        .from('ctes')
        .select('valor_servico, data_emissao')
        .eq('empresa_id', empresa_id)
        .not('chave_acesso', 'is', null)
        .not('chave_acesso', 'ilike', 'omie-%')
        .neq('status', 'Cancelado')
        .gte('data_emissao', inicioMesAntStr)
        .lte('data_emissao', fimMesAntStr)
        .range(f, t))
    }

    // Label do PRIMEIRO card (periodo do relatorio)
    const labelPrimeiroCard = freq === 'Mensal'
      ? `${nomesMesLong[ini.getMonth()]}/${ini.getFullYear()} (este mês)`
      : 'Esta semana'

    // Helper: agrupa CTes em buckets de semana do mes (1-7, 8-14, 15-21, 22-28, 29-fim).
    function bucketsPorSemanaDoMes(ctesArr: any[], anoMes: { ano: number; mes: number }) {
      const ultimoDiaMes = new Date(anoMes.ano, anoMes.mes + 1, 0).getDate()
      const mmStr = String(anoMes.mes + 1).padStart(2, '0')
      const buckets = [
        { ini: 1,  fim: 7  },
        { ini: 8,  fim: 14 },
        { ini: 15, fim: 21 },
        { ini: 22, fim: 28 },
        { ini: 29, fim: ultimoDiaMes },
      ]
      const result: { label: string; valor: number }[] = []
      buckets.forEach((b, idx) => {
        if (b.ini > ultimoDiaMes) return
        const fimReal = Math.min(b.fim, ultimoDiaMes)
        const total = (ctesArr ?? [])
          .filter((r: any) => {
            const dia = parseInt(String(r.data_emissao).slice(8, 10), 10)
            return dia >= b.ini && dia <= fimReal
          })
          .reduce((s: number, r: any) => s + (r.valor_servico ?? 0), 0)
        result.push({
          label: `Sem ${idx + 1} (${String(b.ini).padStart(2, '0')}-${String(fimReal).padStart(2, '0')}/${mmStr})`,
          valor: total,
        })
      })
      return result
    }

    // 6.1. SEMANAL extra: grafico "CT-e por semana" — semanas do mes atual.
    //      So aplica pro relatorio semanal (no mensal isso ja vira o grafico principal).
    let porSemanaDoMes: { label: string; valor: number }[] = []
    let porSemanaDoMesLabel = ''
    if (freq === 'Semanal') {
      // Mes fechado anterior (Maio quando hoje e Jun) — assim sempre tem dado completo
      const mesAntDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      porSemanaDoMes = bucketsPorSemanaDoMes(ctesMesAtualParaGrafico, { ano: mesAntDate.getFullYear(), mes: mesAntDate.getMonth() })
      porSemanaDoMesLabel = `${nomesMesLong[mesAntDate.getMonth()]}/${mesAntDate.getFullYear()} — semanas do mês anterior`
    }

    // 6. Distribuição EVOLUÇÃO TEMPORAL
    //    Semanal: gasto por dia da semana (Seg-Sex, datas exatas).
    //    Mensal:  gasto por SEMANA do mes do relatorio (Sem 1, Sem 2...) — evolucao semanal.
    const nomesDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const porDiaSemana: { label: string; valor: number }[] = []
    let diaSemanaLabel = ''
    let tituloEvolucao = ''

    if (freq === 'Semanal') {
      tituloEvolucao = 'CT-e por dia da semana'
      const ctesSemana = ctes ?? []
      for (let i = 0; i < 5; i++) {
        const dia = new Date(ini); dia.setDate(ini.getDate() + i)
        const diaStr = dia.toISOString().slice(0, 10)
        const total = ctesSemana
          .filter((r: any) => String(r.data_emissao).slice(0, 10) === diaStr)
          .reduce((s: number, r: any) => s + (r.valor_servico ?? 0), 0)
        const dd = String(dia.getDate()).padStart(2, '0')
        const mm = String(dia.getMonth() + 1).padStart(2, '0')
        porDiaSemana.push({ label: `${nomesDia[i + 1]} ${dd}/${mm}`, valor: total })
      }
      diaSemanaLabel = `Semana ${fmtBR(ini)} a ${fmtBR(fim)} — só dias úteis`
    } else {
      // MENSAL: agrupa por semana do mes (5 buckets: 01-07, 08-14, 15-21, 22-28, 29-fim).
      tituloEvolucao = 'CT-e por semana'
      const ctesMes = ctes ?? []
      const ultimoDia = fim.getDate()
      const mm = String(ini.getMonth() + 1).padStart(2, '0')
      const buckets = [
        { ini: 1,  fim: 7  },
        { ini: 8,  fim: 14 },
        { ini: 15, fim: 21 },
        { ini: 22, fim: 28 },
        { ini: 29, fim: ultimoDia },
      ]
      buckets.forEach((b, idx) => {
        if (b.ini > ultimoDia) return
        const fimReal = Math.min(b.fim, ultimoDia)
        const total = ctesMes
          .filter((r: any) => {
            const dia = parseInt(String(r.data_emissao).slice(8, 10), 10)
            return dia >= b.ini && dia <= fimReal
          })
          .reduce((s: number, r: any) => s + (r.valor_servico ?? 0), 0)
        porDiaSemana.push({
          label: `Sem ${idx + 1} (${String(b.ini).padStart(2, '0')}-${String(fimReal).padStart(2, '0')}/${mm})`,
          valor: total,
        })
      })
      diaSemanaLabel = `${nomesMesLong[ini.getMonth()]}/${ini.getFullYear()} — por semana`
    }

    // 7. Renderiza template visual
    const html = templateRelatorio({
      periodoLabel,
      totalGasto,
      totalMesAtual: totalSegundoCard,
      totalAno,
      mediaMensal,
      totalCtes: qtd,
      ticketMedio,
      tipoPeriodo: freq,
      labelPrimeiroCard,
      labelMesAtual: labelSegundoCard,
      labelAno: `${hoje.getFullYear()} até hoje`,
      tituloEvolucao,
      gastosAnual,
      porSemanaDoMes,
      porSemanaDoMesLabel,
      porDiaSemana,
      mesAtualLabel: diaSemanaLabel,
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

    // 6. Marca ultimo envio (campo separado por frequencia)
    if (!emails_override) {
      const campo = freq === 'Mensal' ? 'ultimo_envio_mensal_em' : 'ultimo_envio_semanal_em'
      await supabase
        .from('parametros_alerta')
        .update({ [campo]: new Date().toISOString() })
        .eq('empresa_id', empresa_id)
    }

    return NextResponse.json({
      ok: true,
      periodo: { inicio: iniStr, fim: fimStr, freq },
      total_kpi: totalGasto,
      destinatarios: resultados,
    })
  } catch (e: any) {
    console.error('[relatorio/enviar]', e)
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
