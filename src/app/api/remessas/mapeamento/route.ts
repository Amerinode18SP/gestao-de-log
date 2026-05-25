import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const empresaId = searchParams.get('empresa_id') || process.env.NEXT_PUBLIC_EMPRESA_ID!
    const modal = searchParams.get('modal')
    const transportadora = searchParams.get('transportadora')
    const centroCusto = searchParams.get('centro_custo')
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')

    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('ctes')
      .select(`
        id,
        valor,
        estado_destino,
        modal,
        mes_emissao,
        ano_emissao,
        fornecedor:fornecedores(nome),
        centro_custo:centros_custo(nome)
      `)
      .eq('empresa_id', empresaId)
      .not('estado_destino', 'is', null)
      .neq('status', 'Cancelado')

    if (modal) query = query.eq('modal', modal)
    if (mes) query = query.eq('mes_emissao', parseInt(mes))
    if (ano) query = query.eq('ano_emissao', parseInt(ano))

    const { data: ctes, error } = await query
    if (error) throw error

    const filteredCtes = transportadora
      ? (ctes || []).filter((c: any) => c.fornecedor?.nome === transportadora)
      : (ctes || [])

    const ESTADO_NOMES: Record<string, string> = {
      AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas',
      BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
      GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
      MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
      PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
      RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
      SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
    }

    const byState: Record<string, any> = {}

    for (const cte of filteredCtes) {
      const uf = (cte.estado_destino as string)?.toUpperCase()
      if (!uf || !ESTADO_NOMES[uf]) continue
      if (!byState[uf]) byState[uf] = { name: ESTADO_NOMES[uf], uf, ctes: 0, value: 0, modal: '', modalCounts: {} }
      byState[uf].ctes += 1
      byState[uf].value += Number(cte.valor) || 0
      const m = (cte.modal as string) || 'Rodoviário'
      byState[uf].modalCounts[m] = (byState[uf].modalCounts[m] || 0) + 1
    }

    for (const uf in byState) {
      const counts = byState[uf].modalCounts
      byState[uf].modal = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'Rodoviário'
      delete byState[uf].modalCounts
    }

    const totalValue = filteredCtes.reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0)
    const totalCtes = filteredCtes.length
    const stateCount = Object.keys(byState).length

    const byModal: Record<string, number> = {}
    for (const cte of filteredCtes) {
      const m = (cte.modal as string) || 'Rodoviário'
      byModal[m] = (byModal[m] || 0) + (Number(cte.valor) || 0)
    }

    const byCC: Record<string, number> = {}
    for (const cte of filteredCtes) {
      const cc = (cte as any).centro_custo?.nome || 'Sem C.C.'
      if (centroCusto && cc !== centroCusto) continue
      byCC[cc] = (byCC[cc] || 0) + (Number(cte.valor) || 0)
    }

    const transpSet = new Set<string>()
    for (const cte of (ctes || [])) {
      if ((cte as any).fornecedor?.nome) transpSet.add((cte as any).fornecedor.nome)
    }

    const ccSet = new Set<string>()
    for (const cte of (ctes || [])) {
      if ((cte as any).centro_custo?.nome) ccSet.add((cte as any).centro_custo.nome)
    }

    const sorted = Object.values(byState).sort((a: any, b: any) => b.value - a.value)

    return NextResponse.json({
      summary: {
        totalValue: Math.round(totalValue),
        totalCtes,
        stateCount,
        ticketMedio: totalCtes > 0 ? Math.round(totalValue / totalCtes) : 0,
        topState: sorted[0] || null,
      },
      byState: sorted,
      byModal: Object.entries(byModal).map(([label, value]) => ({ label, value: Math.round(value as number) })),
      byCC: Object.entries(byCC).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([label, value]) => ({ label, value: Math.round(value as number) })),
      transportadoras: Array.from(transpSet).sort(),
      centrosCusto: Array.from(ccSet).sort(),
    })
  } catch (err: any) {
    console.error('[mapeamento]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
