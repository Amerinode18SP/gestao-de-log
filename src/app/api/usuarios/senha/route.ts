// ============================================================
// FREIGHT-MS — API Route: POST /api/usuarios/senha
// Admin define/redefine senha de qualquer usuario
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { id, senha } = await req.json()

    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
    if (!senha || senha.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const { error } = await supabase.auth.admin.updateUserById(id, { password: senha })

    if (error) {
      console.error('[POST usuarios/senha]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}
