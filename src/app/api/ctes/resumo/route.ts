// ============================================================
// FREIGHT-MS - API Route: GET /api/ctes/resumo
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const status     = searchParams.get('status')
  const busca      = searchParams.get('busca')
  const dataInicio = searchParams.get('data_inicio')
  const dataFim    = searchParams.get('data_fim')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Se há busca, buscar fornecedor_ids que batem com o nome
  let fornecedorIds: string[] = []
  if (busca) {
    const { data: forn } = await supabase
      .from('fornecedores')
      .select('id')
      .eq('empresa_id', empresa_id)
      .ilike('nome', `%${busca}%`)
    fornecedorIds = (forn ?? []).map((f: any) => f.id)
  }

  // Monta filtros de data e busca como string SQL para usar no rpc
  // Usamos queries separadas com count para contagens
  const makeCount = (extraEq?: { col: string; val: string }) => {
    let q = supabase
      .from('ctes')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id)

    if (extraEq) q = q.eq(extraEq.col, extraEq.val)
    if (dataInicio) q = q.gte('data_emissao', dataInicio)
    if (dataFim)    q = q.lte('data_emissao', dataFim)
    if (busca) {
      const orParts = [
        `numero_cte.ilike.%${busca}%`,
        `remetente_nome.ilike.%${busca}%`,
        `destinatario_nome.ilike.%${busca}%`,
        `centro_custo_nome.ilike.%${busca}%`,
      ]
      if (fornecedorIds.length > 0) {
        orParts.push(`fornecedor_id.in.(${fornecedorIds.join(',')})`)
      }
      q = q.or(orParts.join(','))
    }
    return q
  }

  // Valor total: busca em lotes de 1000 para somar tudo (igual ao Mapeamento)
  const calcValorTotal = async () => {
    let total = 0
    let from = 0
    const PAGE = 1000
    const filtroStatus = (status && status !== 'Todos') ? status : null

    while (true) {
      let q = supabase
        .from('ctes')
        .select('valor_servico')
        .eq('empresa_id', empresa_id)
        .neq('status', 'Cancelado')
        .range(from, from + PAGE - 1)

      if (filtroStatus) q = q.eq('status', filtroStatus)
      if (dataInicio) q = q.gte('data_emissao', dataInicio)
      if (dataFim)    q = q.lte('data_emissao', dataFim)
      if (busca) {
        const orParts = [
          `numero_cte.ilike.%${busca}%`,
          `remetente_nome.ilike.%${busca}%`,
          `destinatario_nome.ilike.%${busca}%`,
          `centro_custo_nome.ilike.%${busca}%`,
        ]
        if (fornecedorIds.length > 0) {
          orParts.push(`fornecedor_id.in.(${fornecedorIds.join(',')})`)
        }
        q = q.or(orParts.join(','))
      }

      const { data, error } = await q
      if (error || !data) break
      total += data.reduce((a: number, r: any) => a + (r.valor_servico ?? 0), 0)
      if (data.length < PAGE) break
      from += PAGE
    }
    return total
  }

  const [totalRes, faturado, cancelado, pendente, valor_total] = await Promise.all([
    makeCount(),
    makeCount({ col: 'status', val: 'Faturado' }),
    supabase.from('ctes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_id).eq('status', 'Cancelado'),
    makeCount({ col: 'status', val: 'Pendente' }),
    calcValorTotal(),
  ])

  return NextResponse.json({
    total:      totalRes.count  ?? 0,
    faturado:   faturado.count  ?? 0,
    cancelado:  cancelado.count ?? 0,
    pendente:   pendente.count  ?? 0,
    valor_total,
  })
}
