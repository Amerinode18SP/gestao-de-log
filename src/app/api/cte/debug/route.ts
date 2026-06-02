// ============================================================
// Debug do sync Omie — PROTEGIDO por CRON_SECRET no header.
// Mostra exatamente o que ListarContasPagar devolve na pagina 1
// ordenado por DATA_EMISSAO desc. Filtra apenas CTes na resposta
// pra visualizar quais sao as mais recentes do Omie.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  // Auth
  const auth = req.headers.get('x-debug-secret')
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const pagina = Number(req.nextUrl.searchParams.get('pagina') ?? '1')
  const ordenarPor = req.nextUrl.searchParams.get('ordenar_por') ?? 'DATA_EMISSAO'
  const desc = req.nextUrl.searchParams.get('desc') ?? 'S'
  const numero = req.nextUrl.searchParams.get('numero')  // opcional: filtra um numero especifico

  const payload: any = {
    app_key: process.env.OMIE_APP_KEY,
    app_secret: process.env.OMIE_APP_SECRET,
    call: 'ListarContasPagar',
    param: [{
      pagina,
      registros_por_pagina: 50,
      apenas_importado_api: 'N',
      ordenar_por: ordenarPor,
      ordem_descrescente: desc,
    }],
  }

  try {
    const res = await fetch('https://app.omie.com.br/api/v1/financas/contapagar/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (data.faultstring) {
      return NextResponse.json({ erro_omie: data.faultstring }, { status: 500 })
    }

    const todos = data.conta_pagar_cadastro ?? []
    let ctes = todos.filter((r: any) => r.codigo_tipo_documento === 'CTE')

    if (numero) {
      ctes = ctes.filter((r: any) =>
        String(r.numero_documento || '').includes(numero) ||
        String(r.numero_documento_fiscal || '').includes(numero)
      )
    }

    // Mapa enxuto pra visualizar
    const enxuto = ctes.slice(0, 20).map((r: any) => ({
      numero_documento: r.numero_documento,
      numero_documento_fiscal: r.numero_documento_fiscal,
      data_emissao: r.data_emissao,
      data_vencimento: r.data_vencimento,
      status_titulo: r.status_titulo,
      codigo_lancamento_omie: r.codigo_lancamento_omie,
      codigo_cliente_fornecedor: r.codigo_cliente_fornecedor,
      valor_documento: r.valor_documento,
      data_inclusao: r.data_inclusao,
      data_alteracao: r.data_alteracao,
    }))

    return NextResponse.json({
      pagina,
      total_paginas: data.total_de_paginas,
      total_registros: data.total_de_registros,
      registros_na_pagina: todos.length,
      ctes_na_pagina: ctes.length,
      datas_emissao_distintas_nesta_pagina: [...new Set(todos.map((r: any) => r.data_emissao))].slice(0, 10),
      amostra_ctes: enxuto,
    })
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message }, { status: 500 })
  }
}
