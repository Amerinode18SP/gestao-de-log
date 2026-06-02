// ============================================================
// FREIGHT-MS — Diagnostico de usuario Auth (admin only)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'email obrigatorio' }, { status: 400 })

    const supabase = createSupabaseAdmin()

    // Pega TODOS os usuarios do auth (paginado) e filtra por email
    let user: any = null
    let page = 1
    const perPage = 200
    while (page <= 10 && !user) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) {
        return NextResponse.json({ error: error.message, page }, { status: 500 })
      }
      user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (data.users.length < perPage) break
      page++
    }

    if (!user) {
      return NextResponse.json({ found: false, email, paginas_buscadas: page })
    }

    // Pega perfil
    const { data: perfil } = await supabase
      .from('perfis_usuario')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      found: true,
      auth: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        banned_until: user.banned_until,
        invited_at: (user as any).invited_at,
        confirmation_sent_at: (user as any).confirmation_sent_at,
        recovery_sent_at: (user as any).recovery_sent_at,
        has_password: !!(user as any).encrypted_password || user.identities?.some((i: any) => i.provider === 'email') || false,
        identities_providers: user.identities?.map((i: any) => i.provider) ?? [],
      },
      perfil,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

// POST: força "destravamento" — set senha + confirma email + remove ban
export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) {
      return NextResponse.json({ error: 'email e senha obrigatorios' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'senha minimo 6 caracteres' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Acha usuario
    let user: any = null
    let page = 1
    while (page <= 10 && !user) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      user = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!data?.users || data.users.length < 200) break
      page++
    }
    if (!user) {
      return NextResponse.json({ error: 'usuario nao encontrado no auth' }, { status: 404 })
    }

    // Forca senha + email_confirm + ban_duration null
    const { data: updated, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: senha,
      email_confirm: true,
      ban_duration: 'none',
    } as any)

    if (error) {
      return NextResponse.json({ error: error.message, user_id: user.id }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      email: updated?.user?.email,
      email_confirmed_at: updated?.user?.email_confirmed_at,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
