import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const empresaId = searchParams.get('empresa_id') || process.env.NEXT_PUBLIC_EMPRESA_ID!
    const modal      = searchParams.get('modal')
    const transp     = searchParams.get('transportadora')
    const cc         = searchParams.get('centro_custo')
    const mes        = searchParams.get('mes')
    const ano        = searchParams.get('ano')

    const supabase = createSupabaseAdmin()

    // Descobre os nomes reais das colunas de valor e data na tabela ctes
    const { data: cols } = await supabase
      .from('information_schema.columns' as any)
      .select('column_name')
      .eq('table_name', 'ctes')
      .in('column_name', [
        'valor','value','valor_total','valor_cte','valor_frete',
        'data_emissao','data_vencimento','data_lancamento',
        'estado_destino','uf_destino','uf','estado',
        'modal','tipo_modal','tipo_frete',
        'mes_emissao','ano_emissao',
      ])

    const colNames = (cols || []).map((c: any) => c.column_name)

    // Campo valor
    const campoValor = ['valor_total','valor_cte','valor_frete','valor','value']
      .find(c => colNames.includes(c)) || 'valor_documento'

    // Campo estado destino  
    const campoEstado = ['estado_destino','uf_destino','uf','estado']
      .find(c => colNames.includes(c)) || 'estado_destino'

    // Campo modal
    const campoModal = ['modal','tipo_modal','tipo_frete']
      .find(c => colNames.includes(c)) || 'modal'

    // Campo data
    const campoData = ['data_emissao','data_vencimento','data_lancamento']
      .find(c => colNames.includes(c)) || 'data_emissao'

    // Monta select dinâmico
    const selectFields = [
      'id',
      campoValor,
      campoEstado,
      campoModal,
      campoData,
      'fornecedor:fornecedores(nome)',
      'centro_custo:centros_custo(nome)',
    ].join(',\n        ')

    let query = supabase
      .from('ctes')
      .select(selectFields)
      .eq('empresa_id', empresaId)
      .not(campoEstado, 'is', null)
      .neq('status', 'Cancelado')

    if (modal) query = query.eq(campoModal, modal)

    const { data: ctes, error } = await query
    if (error) throw new Error(`Query error: ${error.message} | campos: valor=${campoValor}, estado=${campoEstado}`)

    // Filtra em memória (transportadora, cc, mes, ano)
    const filtered = (ctes || []).filter((c: any) => {
      const nomeTransp = c.fornecedor?.nome || ''
      const nomeCC     = c.centro_custo?.nome || ''
      const dataStr    = c[campoData] || ''
      const cMes       = dataStr ? new Date(dataStr).getMonth() + 1 : null
      const cAno       = dataStr ? new Date(dataStr).getFullYear() : null
      return (
        (!transp || nomeTransp === transp) &&
        (!cc     || nomeCC === cc) &&
        (!mes    || String(cMes) === mes) &&
        (!ano    || String(cAno) === ano)
      )
    })

    const ESTADOS: Record<string, string> = {
      AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',
      CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',
      MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',
      PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',
      RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',
      RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',
      SE:'Sergipe',TO:'Tocantins',
    }

    const byState: Record<string, any> = {}
    const byModal:  Record<string, number> = {}
    const byCC:     Record<string, number> = {}
    const transpSet = new Set<string>()
    const ccSet     = new Set<string>()

    // Coleta transportadoras/cc de TODOS os registros (sem filtro de transp/cc)
    for (const c of (ctes || [])) {
      if (c.fornecedor?.nome)   transpSet.add(c.fornecedor.nome)
      if (c.centro_custo?.nome) ccSet.add(c.centro_custo.nome)
    }

    for (const c of filtered) {
      const uf  = String(c[campoEstado] || '').toUpperCase().trim()
      if (!uf || !ESTADOS[uf]) continue

      const val = Number(c[campoValor]) || 0
      const mod = String(c[campoModal]  || 'Rodoviário')
      const ccN = c.centro_custo?.nome  || 'Sem C.C.'

      if (!byState[uf]) byState[uf] = { name: ESTADOS[uf], uf, ctes: 0, value: 0, modal: '', modalCounts: {} }
      byState[uf].ctes  += 1
      byState[uf].value += val
      byState[uf].modalCounts[mod] = (byState[uf].modalCounts[mod] || 0) + 1

      byModal[mod] = (byModal[mod] || 0) + val
      byCC[ccN]    = (byCC[ccN]    || 0) + val
    }

    for (const uf in byState) {
      const mc = byState[uf].modalCounts
      byState[uf].modal = Object.entries(mc).sort((a:any,b:any)=>b[1]-a[1])[0]?.[0] || 'Rodoviário'
      delete byState[uf].modalCounts
    }

    const sorted     = Object.values(byState).sort((a:any,b:any) => b.value - a.value)
    const totalValue = filtered.reduce((s:number,c:any) => s + (Number(c[campoValor])||0), 0)
    const totalCtes  = filtered.length

    return NextResponse.json({
      debug: { campoValor, campoEstado, campoModal, campoData, totalRegistros: (ctes||[]).length },
      summary: {
        totalValue:  Math.round(totalValue),
        totalCtes,
        stateCount:  sorted.length,
        ticketMedio: totalCtes > 0 ? Math.round(totalValue / totalCtes) : 0,
        topState:    sorted[0] || null,
      },
      byState: sorted,
      byModal: Object.entries(byModal).map(([label,value]) => ({ label, value: Math.round(value as number) })),
      byCC:    Object.entries(byCC).sort((a,b)=>(b[1] as number)-(a[1] as number)).map(([label,value]) => ({ label, value: Math.round(value as number) })),
      transportadoras: Array.from(transpSet).sort(),
      centrosCusto:    Array.from(ccSet).sort(),
    })
  } catch (err: any) {
    console.error('[mapeamento]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
