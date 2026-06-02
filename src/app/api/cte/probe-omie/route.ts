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
      sample: text.slice(0, 800),
    }
  } catch (e: any) {
    return { endpoint, call, error: e.message, ms: Date.now() - start }
  }
}

export async function GET(_req: NextRequest) {
  if (!process.env.OMIE_APP_KEY || !process.env.OMIE_APP_SECRET) {
    return NextResponse.json({ error: 'OMIE_APP_KEY/SECRET ausentes' }, { status: 500 })
  }
  const candidates = [
    { ep: '/produtos/cte/',   call: 'ListarCte',  p: { nPagina: 1, nRegPorPagina: 5, cOrdenarPor: 'DATA_EMISSAO', cOrdemDecrescente: 'S' } },
    { ep: '/produtos/cte/',   call: 'ListarCtes', p: { nPagina: 1, nRegPorPagina: 5 } },
    { ep: '/produtos/cte/',   call: 'ListarConhecimentoTransporte', p: { nPagina: 1, nRegPorPagina: 5 } },
    { ep: '/produtos/cte/',   call: 'ListarCT', p: { nPagina: 1, nRegPorPagina: 5 } },
    { ep: '/produtos/cte/',   call: 'PesquisarCte', p: { nPagina: 1, nRegPorPagina: 5 } },
    { ep: '/geral/cte/',      call: 'ListarCte', p: { nPagina: 1, nRegPorPagina: 5 } },
  ]
  const results = []
  for (const c of candidates) {
    results.push(await tryCall(c.ep, c.call, c.p))
  }
  return NextResponse.json({ results })
}
