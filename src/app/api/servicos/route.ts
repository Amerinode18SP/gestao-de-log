// ============================================================
// API Route: /api/servicos  (Frete / Coleta / Motoboy)
// Usa service role (igual /api/ctes) — escrita/leitura passam pelo
// servidor, evitando o RLS por empresa do acesso direto do navegador.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const maxDuration = 60

function sanitizar(r: Record<string, any>, empresa_id: string) {
  const out = { ...r, empresa_id }
  // UF é char(2) no banco — corta excesso pra não derrubar o lote inteiro
  for (const k of ['origem_uf', 'destino_uf']) {
    if (out[k]) out[k] = String(out[k]).trim().slice(0, 2).toUpperCase()
  }
  if (!out.tipo) out.tipo = 'Motoboy'
  delete out.id
  return out
}

// -------- LISTAR --------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  const tipo = searchParams.get('tipo')
  const mes = searchParams.get('mes')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  let q = supabase.from('servicos').select('*').eq('empresa_id', empresa_id)
  if (tipo && tipo !== 'Todos') q = q.eq('tipo', tipo)
  if (mes) q = q.eq('mes_referencia', mes)
  const { data, error } = await q
    .order('data_servico', { ascending: false, nullsFirst: false })
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ servicos: data ?? [] })
}

// -------- INSERIR (import em lote ou cadastro manual) --------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const empresa_id: string = body.empresa_id
    const registros: any[] = Array.isArray(body.registros) ? body.registros : []
    if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })
    if (registros.length === 0) return NextResponse.json({ error: 'nenhum registro' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const limpos = registros.map(r => sanitizar(r, empresa_id))
    let inseridos = 0
    const LOTE = 200
    for (let i = 0; i < limpos.length; i += LOTE) {
      const lote = limpos.slice(i, i + LOTE)
      const { error } = await supabase.from('servicos').insert(lote)
      if (error) {
        return NextResponse.json({ error: error.message, inseridos }, { status: 500 })
      }
      inseridos += lote.length
    }
    return NextResponse.json({ inseridos })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// -------- ATUALIZAR --------
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, empresa_id, campos } = body
    if (!id || !empresa_id) return NextResponse.json({ error: 'id e empresa_id obrigatorios' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const limpos = sanitizar(campos ?? {}, empresa_id)
    const { error } = await supabase.from('servicos').update(limpos).eq('id', id).eq('empresa_id', empresa_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// -------- EXCLUIR --------
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const empresa_id = searchParams.get('empresa_id')
  if (!id || !empresa_id) return NextResponse.json({ error: 'id e empresa_id obrigatorios' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { error } = await supabase.from('servicos').delete().eq('id', id).eq('empresa_id', empresa_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
