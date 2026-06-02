// ============================================================
// FREIGHT-MS — Testa login server-side pra diagnosticar
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) {
      return NextResponse.json({ error: 'email e senha obrigatorios' }, { status: 400 })
    }

    // Usa anon key (client publico) pra simular o login real do navegador
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

    return NextResponse.json({
      sucesso: !error,
      erro_completo: error ? { message: error.message, status: (error as any).status, code: (error as any).code } : null,
      usuario: data?.user ? {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at,
        last_sign_in_at: data.user.last_sign_in_at,
      } : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
