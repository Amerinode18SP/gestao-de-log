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

// POST: RECRIA a conta no Auth com email+senha (delete + create)
// Usado quando a conta existe mas sem identidade de email/senha
// (caso de usuario criado via invite link que nunca completou o fluxo).
// Mantém os dados do perfil (nome, papel, empresa) atualizando o id.
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

    // 1. Acha usuario auth atual (se existir)
    let userAtual: any = null
    let page = 1
    while (page <= 10 && !userAtual) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      userAtual = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!data?.users || data.users.length < 200) break
      page++
    }

    // 2. Guarda perfil existente (pra preservar nome/papel/empresa)
    let perfilOriginal: any = null
    if (userAtual) {
      const { data } = await supabase
        .from('perfis_usuario')
        .select('*')
        .eq('id', userAtual.id)
        .maybeSingle()
      perfilOriginal = data
    }

    // 3. Deleta o user antigo do auth (se existir) — leva junto o perfil via FK
    if (userAtual) {
      // Salva perfil em variável antes de deletar (FK cascade)
      await supabase.auth.admin.deleteUser(userAtual.id)
    }

    // 4. Cria novo user auth com email+senha+email_confirm
    const { data: novo, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: perfilOriginal ? { nome: perfilOriginal.nome } : undefined,
    })
    if (createErr || !novo?.user) {
      return NextResponse.json({ error: createErr?.message || 'Falha ao criar user' }, { status: 500 })
    }

    // 5. Recria perfil com novo id (preservando dados originais)
    if (perfilOriginal) {
      const { error: perfilErr } = await supabase.from('perfis_usuario').upsert({
        id: novo.user.id,
        empresa_id: perfilOriginal.empresa_id,
        nome: perfilOriginal.nome,
        email,
        papel: perfilOriginal.papel,
        ativo: true,
      })
      if (perfilErr) {
        return NextResponse.json({
          ok: false,
          warning: 'User criado mas perfil falhou',
          user_id: novo.user.id,
          perfil_erro: perfilErr.message,
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      user_id: novo.user.id,
      email: novo.user.email,
      email_confirmed_at: novo.user.email_confirmed_at,
      mensagem: perfilOriginal
        ? `Conta de ${perfilOriginal.nome} recriada — senha definida.`
        : `Conta criada — senha definida.`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
