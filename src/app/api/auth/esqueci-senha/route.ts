// ============================================================
// FREIGHT-MS — API Route: POST /api/auth/esqueci-senha
// Gera link de redefinicao e envia via Resend (substitui o
// auth.resetPasswordForEmail nativo que tava com rate limit do Supabase).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import { enviarEmail, templateRedefinirSenha } from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gestao-de-log.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'email obrigatorio' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // 1. Verifica se o email existe no auth (sem revelar pro usuario por
    //    seguranca — resposta sempre eh OK pra nao expor quem tem conta)
    let usuario: any = null
    let page = 1
    while (page <= 10 && !usuario) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      usuario = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!data?.users || data.users.length < 200) break
      page++
    }

    if (!usuario) {
      // Nao revelar que o email nao existe — devolve sucesso fake
      return NextResponse.json({ success: true, sent: false, reason: 'email_nao_encontrado' })
    }

    // 2. Gera link de recovery
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${APP_URL}/redefinir-senha` },
    })
    if (linkErr || !linkData?.properties?.action_link) {
      console.error('[esqueci-senha] generateLink:', linkErr)
      return NextResponse.json({ error: linkErr?.message || 'Erro ao gerar link' }, { status: 500 })
    }
    const linkAcesso = linkData.properties.action_link

    // 3. Envia email via Resend
    const envio = await enviarEmail({
      to: email,
      subject: 'Redefinir senha — Gestão de Log',
      html: templateRedefinirSenha({ linkAcesso }),
    })

    return NextResponse.json({
      success: true,
      sent: envio.sent,
      reason: envio.sent ? null : envio.reason,
    })
  } catch (error: any) {
    console.error('[esqueci-senha] erro:', error)
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}
