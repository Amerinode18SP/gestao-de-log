import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { enviarEmail, templateConvite } from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gestao-de-log.vercel.app'

// Gera senha aleatória forte (usuário nunca vai usar — só serve pra criar a
// identity de email. Pessoa vai resetar via link de recovery).
function senhaAleatoria() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
  let s = ''
  for (let i = 0; i < 24; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { nome, email, papel } = await request.json()

    if (!nome || !email || !papel) {
      return NextResponse.json({ error: 'Nome, email e papel são obrigatórios' }, { status: 400 })
    }

    const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID!
    let usuarioId = ''

    // 1. Verifica se já existe um usuário com este email
    let existente: any = null
    let page = 1
    while (page <= 10 && !existente) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      existente = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!data?.users || data.users.length < 200) break
      page++
    }

    if (existente) {
      // Usuário já existe — pode estar quebrado (sem identidade). Reseta criando do zero.
      await supabase.auth.admin.deleteUser(existente.id)
    }

    // 2. Cria conta limpa com email confirmado e senha provisória aleatória
    //    (garante que a "identity" de email/senha seja criada — bug do invite link
    //     sem identidade que travou a Luciana no inicio nao acontece mais)
    const { data: novo, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: senhaAleatoria(),
      email_confirm: true,
      user_metadata: { nome, papel, empresa_id: empresaId },
    })
    if (createErr || !novo?.user) {
      console.error('[convidar] createUser:', createErr)
      return NextResponse.json({ error: createErr?.message || 'Falha ao criar usuário' }, { status: 500 })
    }
    usuarioId = novo.user.id

    // 3. Cria perfil
    const { error: upsertError } = await supabase.from('perfis_usuario').upsert({
      id: usuarioId,
      empresa_id: empresaId,
      nome,
      email,
      papel,
      ativo: true,
    })
    if (upsertError) {
      console.error('[convidar] upsert perfil:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // 4. Gera link de recovery — usuário clica e cai na tela de definir senha
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${APP_URL}/redefinir-senha` },
    })
    if (linkErr || !linkData?.properties?.action_link) {
      console.error('[convidar] generateLink:', linkErr)
      return NextResponse.json({ error: linkErr?.message || 'Falha ao gerar link' }, { status: 500 })
    }
    const linkAcesso = linkData.properties.action_link

    // 5. Envia email via Resend
    const envio = await enviarEmail({
      to: email,
      subject: `Bem-vindo ao Gestão de Log, ${nome.split(' ')[0]}!`,
      html: templateConvite({ nome, papel, linkAcesso }),
    })

    return NextResponse.json({
      success: true,
      message: envio.sent
        ? `Convite enviado para ${email}`
        : `Conta criada para ${email}. Email não enviado (${envio.reason}) — copie o link abaixo e mande manualmente.`,
      action_link: linkAcesso,
      email_enviado: envio.sent,
    })
  } catch (error: any) {
    console.error('[convidar] erro:', error)
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}
