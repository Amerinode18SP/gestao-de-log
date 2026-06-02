// ============================================================
// FREIGHT-MS — Probe temporario para descobrir endpoint correto da Cobli
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BASE = 'https://app.omie.com.br/api/v1'

async function tryCall(endpoint: string, call: string, param: object) {
  const payload = {
    app_key: process.env.OMIE_APP_KEY,
    app_secret: process.env.OMIE_APP_SECRET,
    call,
    param: [param],
  }
  const start = Date.now()
  try {
    const res = await fetch(BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    return {
      endpoint, call,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - start,
      sample: text.slice(0, 30000),
    }
  } catch (e: any) {
    return { endpoint, call, error: e.message, ms: Date.now() - start }
  }
}

export async function GET(_req: NextRequest) {
  if (!process.env.OMIE_APP_KEY || !process.env.OMIE_APP_SECRET) {
    return NextResponse.json({ error: 'OMIE_APP_KEY/SECRET ausentes' }, { status: 500 })
  }
  // Pega data 60 dias atras pro filtro
  const hoje = new Date()
  const inicio = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000)
  const fmtBR = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  const dataDe = fmtBR(inicio)
  const dataAte = fmtBR(hoje)

  // Modo 1: ver primeiras CTes ordenadas por DATA_EMISSAO desc (so 1 call)
  const candidates = [
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: {
      pagina: 1, registros_por_pagina: 100, apenas_importado_api: 'N',
      ordenar_por: 'DATA_EMISSAO', ordem_descrescente: 'S',
    } },
    // Modo 2: tentar filtrar por numero_documento direto pra achar 26971
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: {
      pagina: 1, registros_por_pagina: 50, apenas_importado_api: 'N',
      filtrar_apenas_titulo_documento: '000026971',
    } },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: {
      pagina: 1, registros_por_pagina: 50, apenas_importado_api: 'N',
      nNumDocumento: '000026971',
    } },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: {
      pagina: 1, registros_por_pagina: 50, apenas_importado_api: 'N',
      numero_documento: '000026971',
    } },
    // Modo 3: ordenar por CODIGO (lançamento) desc — vê se traz mais recente
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: {
      pagina: 1, registros_por_pagina: 20, apenas_importado_api: 'N',
      ordenar_por: 'CODIGO', ordem_descrescente: 'S',
    } },
    // Modo 4: ConsultarLancamento (se quiser achar uma especifica)
    { ep: '/financas/contapagar/', call: 'ConsultarConta', p: {
      chave_lancamento: { numero_documento_fiscal: '000026971' },
    } },
  ]
  // Só o primeiro candidato pra evitar REDUNDANT
  const result = await tryCall(candidates[0].ep, candidates[0].call, candidates[0].p)
  return NextResponse.json({ results: [result] })
}
