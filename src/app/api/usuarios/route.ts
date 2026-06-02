import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('perfis_usuario')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ usuarios: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { id, papel, ativo, nome } = await req.json()
  const supabase = createSupabaseAdmin()

  const updates: any = {}
  if (papel !== undefined) updates.papel = papel
  if (ativo !== undefined) updates.ativo = ativo
  if (nome !== undefined) updates.nome = nome

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const { error } = await supabase
    .from('perfis_usuario')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/usuarios?id=<uuid> — admin exclui usuario
// Remove tanto do perfis_usuario quanto do auth.users
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  // 1. Remove perfil
  const { error: perfilErr } = await supabase
    .from('perfis_usuario')
    .delete()
    .eq('id', id)
  if (perfilErr) {
    console.error('[DELETE usuarios] perfil:', perfilErr.message)
    return NextResponse.json({ error: perfilErr.message }, { status: 500 })
  }

  // 2. Remove auth user (Supabase Auth admin API)
  const { error: authErr } = await supabase.auth.admin.deleteUser(id)
  if (authErr) {
    console.warn('[DELETE usuarios] auth (perfil ja removido):', authErr.message)
    // Continua — perfil removido, auth users tem cleanup de outras formas
  }

  return NextResponse.json({ ok: true })
}
