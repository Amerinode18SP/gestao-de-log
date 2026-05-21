// ============================================================
// FREIGHT-MS — API Route: POST /api/omie/sync-fornecedores
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { createOmieClient } from '@/lib/omie/client'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    const cronKey = req.headers.get('x-cron-key')
    if (cronKey !== process.env.CRON_SECRET && !auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { empresa_id, pagina_inicio = 1 } = body
    if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const client = createOmieClient()

    // Buscar fornecedores do Omie (40 páginas por vez)
    const MAX_PAG = 40
    let pagina = pagina_inicio
    let totalPaginas = pagina_inicio + MAX_PAG - 1
    let importados = 0

    do {
      const data = await client.listarFornecedores(pagina, 50)
      totalPaginas = data.total_paginas

      const upserts = (data.fornecedores ?? []).map((f: any) => ({
        empresa_id,
        nome: f.razao_social ?? f.nome_fantasia ?? '',
        cnpj: (f.cnpj_cpf ?? '').replace(/\D/g, ''),
        omie_codigo: f.codigo_fornecedor_omie ?? null,
        ativo: f.inativo !== 'S',
      })).filter((f: any) => f.nome)

      if (upserts.length > 0) {
        await supabase
          .from('fornecedores')
          .upsert(upserts, { onConflict: 'empresa_id,cnpj', ignoreDuplicates: false })
        importados += upserts.length
      }

      pagina++
      if (pagina <= Math.min(pagina_inicio + MAX_PAG - 1, totalPaginas)) {
        await new Promise(r => setTimeout(r, 350))
      }
    } while (pagina <= Math.min(pagina_inicio + MAX_PAG - 1, totalPaginas))

    const proxima_pagina = pagina <= totalPaginas ? pagina : undefined

    return NextResponse.json({
      message: proxima_pagina ? `Continuar da página ${proxima_pagina}` : 'Fornecedores sincronizados',
      importados,
      proxima_pagina,
      total_paginas: totalPaginas,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
