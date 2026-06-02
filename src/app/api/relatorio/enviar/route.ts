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

    // 3. Agrega dados (mesma logica do /api/cte/dashboard mas focada em email)
    const { data: ctes } = await supabase
      .from('ctes')
      .select('id, status, valor_servico, peso_taxado, modal, fornecedor_id, uf_destino, fornecedor:fornecedores(nome)')
      .eq('empresa_id', empresa_id)
      .in('status', ['Faturado', 'Recebido'])
      .gte('data_emissao', iniStr)
      .lte('data_emissao', hojeStr)

    const total = (ctes ?? []).reduce((s, c: any) => s + (c.valor_servico ?? 0), 0)
    const peso  = (ctes ?? []).reduce((s, c: any) => s + (c.peso_taxado ?? 0), 0)
    const qtd   = ctes?.length ?? 0
    const ticket = qtd > 0 ? total / qtd : 0

    // Top fornecedores
    const fornMap = new Map<string, { nome: string; valor: number; ctes: number }>()
    ;(ctes ?? []).forEach((c: any) => {
      const id = c.fornecedor_id
      if (!id) return
      const nome = c.fornecedor?.nome ?? id
      const atual = fornMap.get(id) ?? { nome, valor: 0, ctes: 0 }
      fornMap.set(id, { nome, valor: atual.valor + (c.valor_servico ?? 0), ctes: atual.ctes + 1 })
    })
    const topFornecedores = [...fornMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 10)

    // 4. Renderiza template
    const html = templateRelatorio({
      titulo: 'Gestão de Log — Resumo',
      periodoLabel,
      kpis: [
        { label: 'Valor total faturado',  valor: total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        { label: 'CT-e emitidos',         valor: String(qtd) },
        { label: 'Ticket médio',          valor: ticket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        { label: 'Peso total (kg)',       valor: peso.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) },
      ],
      topFornecedores,
      totalCtes: qtd,
      appUrl: APP_URL,
    })

    // 5. Envia para todos os emails (uma chamada Resend por destinatario)
    const resultados: any[] = []
    for (const to of emails) {
      const r = await enviarEmail({
        to,
        subject: `${periodoLabel} — ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
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
      total_kpi: total,
      destinatarios: resultados,
    })
  } catch (e: any) {
    console.error('[relatorio/enviar]', e)
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
