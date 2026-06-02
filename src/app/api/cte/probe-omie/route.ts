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
  // Pega data 60 dias atras pro filtro
  const hoje = new Date()
  const inicio = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000)
  const fmtBR = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  const dataDe = fmtBR(inicio)
  const dataAte = fmtBR(hoje)

  const base = { pagina: 1, registros_por_pagina: 5, apenas_importado_api: 'N' }
  const candidates = [
    // Ordenar por DATA_EMISSAO + variantes de "decrescente"
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'DATA_EMISSAO' } },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'DATA_EMISSAO', ordem_descrescente: 'S' } },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'DATA_EMISSAO', ordem_decrescente: 'S' } },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'DATA_EMISSAO', ordem: 'desc' } },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'DATA_EMISSAO', descrescente: 'S' } },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'DATA_EMISSAO', decrescente: 'S' } },
    // Ordenar por CODIGO desc (que normalmente cresce com tempo)
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'CODIGO' } },
  ]
  const results = []
  for (const c of candidates) {
    results.push(await tryCall(c.ep, c.call, c.p))
  }
  return NextResponse.json({ results })
}
