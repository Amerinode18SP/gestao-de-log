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

  const base = { pagina: 1, registros_por_pagina: 3, apenas_importado_api: 'N' }
  const candidates = [
    // 1. Sem filtro de data — para ver ordenação default e primeiro item
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: base, label: 'sem_filtro' },
    // 2. Tentar variações de nomes de campo para filtro de data
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, data_de: dataDe, data_ate: dataAte }, label: 'data_de/ate' },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, data_inicio: dataDe, data_fim: dataAte }, label: 'data_inicio/fim' },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, dDataDe: dataDe, dDataAte: dataAte }, label: 'dDataDe/Ate' },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, filtrar_apenas_emitidas_de: dataDe, filtrar_apenas_emitidas_ate: dataAte }, label: 'filtrar_apenas_emitidas_*' },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, dDtEmissaoDe: dataDe, dDtEmissaoAte: dataAte }, label: 'dDtEmissao_de/ate' },
    // 3. Tentar parâmetros de ordenação
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, ordenar_por: 'data_emissao', ordem_descrescente: 'S' }, label: 'ordenar_emissao_desc' },
    { ep: '/financas/contapagar/', call: 'ListarContasPagar', p: { ...base, cOrdenarPor: 'DATA_EMISSAO', cOrdemDecrescente: 'S' }, label: 'cOrdenar_DATA_EMISSAO' },
  ]
  const results = []
  for (const c of candidates) {
    results.push(await tryCall(c.ep, c.call, c.p))
  }
  return NextResponse.json({ results })
}
