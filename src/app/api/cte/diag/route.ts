// ============================================================
// FREIGHT-MS — Diagnostico temporario (remover depois)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const supabase = createSupabaseAdmin()

  // 0. Pre-diag: contagem total sem filtro de empresa e empresas que existem
  const { count: totalSemFiltro } = await supabase
    .from('ctes').select('*', { count: 'exact', head: true })
  const { data: empresas } = await supabase
    .from('ctes').select('empresa_id').limit(10)
  const empresasUnicas = [...new Set((empresas ?? []).map((r: any) => r.empresa_id))]

  if (!empresa_id) {
    return NextResponse.json({
      info: 'Passe ?empresa_id=<uuid>',
      total_ctes_no_banco_sem_filtro: totalSemFiltro,
      empresa_ids_encontrados: empresasUnicas,
      env_check: {
        tem_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        tem_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabase_url_host: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '').split('.')[0],
      },
    })
  }

  // 1. Total geral
  const { count: total } = await supabase
    .from('ctes')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresa_id)

  // 2. Status distribuicao — buscar amostra grande e agregar
  const { data: amostra } = await supabase
    .from('ctes')
    .select('status, chave_acesso, omie_id, numero_cte, data_emissao')
    .eq('empresa_id', empresa_id)
    .limit(10000)

  const distStatus = new Map<string, number>()
  let comChaveReal = 0, comOmiePrefix = 0, semChave = 0
  let maxOmieId = 0, minOmieId = Number.MAX_SAFE_INTEGER
  let dataMaisRecente = '', dataMaisAntiga = ''

  for (const r of amostra ?? []) {
    const s = r.status ?? '(null)'
    distStatus.set(s, (distStatus.get(s) ?? 0) + 1)

    if (!r.chave_acesso) semChave++
    else if (r.chave_acesso.startsWith('omie-')) comOmiePrefix++
    else comChaveReal++

    if (r.omie_id) {
      if (r.omie_id > maxOmieId) maxOmieId = r.omie_id
      if (r.omie_id < minOmieId) minOmieId = r.omie_id
    }
    if (r.data_emissao) {
      if (!dataMaisRecente || r.data_emissao > dataMaisRecente) dataMaisRecente = r.data_emissao
      if (!dataMaisAntiga || r.data_emissao < dataMaisAntiga) dataMaisAntiga = r.data_emissao
    }
  }

  // 3. Procurar CTe 26971 especifico
  const { data: cte26971 } = await supabase
    .from('ctes')
    .select('id, numero_cte, chave_acesso, status, data_emissao, omie_id, valor_servico')
    .eq('empresa_id', empresa_id)
    .or('numero_cte.ilike.%26971%,omie_id.eq.26971')
    .limit(5)

  // 4. Ultimo sync log
  const { data: ultimosSync } = await supabase
    .from('sync_logs')
    .select('iniciado_em, finalizado_em, status, ctes_importados, ctes_atualizados, pagina_inicio, proxima_pagina, erro_mensagem')
    .eq('empresa_id', empresa_id)
    .order('iniciado_em', { ascending: false })
    .limit(5)

  // 5. Amostra de 3 CTes recentes pra ver estrutura real
  const { data: ctesRecentes } = await supabase
    .from('ctes')
    .select('numero_cte, chave_acesso, status, data_emissao, omie_id, valor_servico, fornecedor_id, remetente_nome')
    .eq('empresa_id', empresa_id)
    .order('omie_id', { ascending: false, nullsFirst: false })
    .limit(5)

  return NextResponse.json({
    total_no_banco: total,
    amostra_analisada: amostra?.length ?? 0,
    distribuicao_status: Object.fromEntries(distStatus),
    chave_acesso: {
      com_chave_real_nfe: comChaveReal,
      com_prefixo_omie: comOmiePrefix,
      sem_chave: semChave,
    },
    omie_id_range: { min: minOmieId === Number.MAX_SAFE_INTEGER ? null : minOmieId, max: maxOmieId },
    datas_range: { mais_antiga: dataMaisAntiga, mais_recente: dataMaisRecente },
    cte_26971: cte26971 ?? [],
    ultimos_5_sync_logs: ultimosSync ?? [],
    ctes_mais_recentes_por_omie_id: ctesRecentes ?? [],
  })
}
