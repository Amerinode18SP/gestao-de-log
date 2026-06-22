// ============================================================
// API Route: /api/servicos  (Frete / Coleta / Motoboy)
// Usa service role (igual /api/ctes) — escrita/leitura passam pelo
// servidor, evitando o RLS por empresa do acesso direto do navegador.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { chavesDuplicidade, filtrarDuplicados } from '@/lib/servicos/dedup'

export const maxDuration = 60

function sanitizar(r: Record<string, any>, empresa_id: string) {
  const out: Record<string, any> = { ...r, empresa_id }
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
  const all = searchParams.get('all') === '1' // traz TODOS (paginado), sem cap de 2000
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const query = () => {
    let q = supabase.from('servicos').select('*').eq('empresa_id', empresa_id)
    if (tipo && tipo !== 'Todos') q = q.eq('tipo', tipo)
    if (mes) q = q.eq('mes_referencia', mes)
    return q.order('data_servico', { ascending: false, nullsFirst: false })
  }

  // all=1: pagina de 1000 em 1000 até acabar (usado pelo Painel, que
  // precisa do conjunto completo para os gráficos/export — o cap de 2000
  // cortava os meses mais antigos).
  if (all) {
    const PAGE = 1000
    const todos: any[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await query().range(from, from + PAGE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      todos.push(...data)
      if (data.length < PAGE) break
    }
    return NextResponse.json({ servicos: todos })
  }

  const { data, error } = await query().limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ servicos: data ?? [] })
}

// -------- INSERIR (import em lote ou cadastro manual) --------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const empresa_id: string = body.empresa_id
    const registros: any[] = Array.isArray(body.registros) ? body.registros : []
    const dedup: boolean = body.dedup === true
    if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })
    if (registros.length === 0) return NextResponse.json({ error: 'nenhum registro' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    let limpos = registros.map(r => sanitizar(r, empresa_id))
    let duplicados = 0

    // Trava anti-duplicado (só no import): descarta linhas que repetem,
    // em >=3 de 4 campos (fornecedor, data, chamado, valor), um registro
    // já existente ou outro do mesmo lote. Ver src/lib/servicos/dedup.ts.
    if (dedup) {
      const existentes = new Set<string>()
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('servicos')
          .select('fornecedor,data_servico,chamados,valor_total,hora_saida,os_controle')
          .eq('empresa_id', empresa_id)
          .range(from, from + PAGE - 1)
        if (error || !data || data.length === 0) break
        for (const row of data) for (const k of chavesDuplicidade(row)) existentes.add(k)
        if (data.length < PAGE) break
      }
      const r = filtrarDuplicados(limpos, existentes)
      limpos = r.aceitos
      duplicados = r.duplicados
    }

    let inseridos = 0
    const LOTE = 200
    for (let i = 0; i < limpos.length; i += LOTE) {
      const lote = limpos.slice(i, i + LOTE)
      const { error } = await supabase.from('servicos').insert(lote)
      if (error) {
        return NextResponse.json({ error: error.message, inseridos, duplicados }, { status: 500 })
      }
      inseridos += lote.length
    }
    return NextResponse.json({ inseridos, duplicados })
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
