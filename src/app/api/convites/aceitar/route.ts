// ============================================================
// FREIGHT-MS — API Route: POST /api/convites/aceitar
// Valida codigo do convite, marca como usado e gera o link real
// do Supabase pra redirecionar o usuario. Esta API so eh chamada
// quando a pessoa CLICA o botao "Definir minha senha" na pagina
// intermediaria — Safe Links nao chegam aqui (eles param na pagina).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gestao-de-log.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const { codigo } = await request.json()
    if (!codigo) return NextResponse.json({ error: 'codigo obrigatorio' }, { status: 400 })

    const supabase = createSupabaseAdmin()

    // 1. Busca convite
    const { data: convite, error: cErr } = await supabase
      .from('convites')
      .select('*')
      .eq('codigo', codigo)
      .maybeSingle()

    if (cErr || !convite) {
      return NextResponse.json({ error: 'Convite invalido' }, { status: 404 })
    }
    if (convite.usado_em) {
      return NextResponse.json({ error: 'Este convite ja foi usado' }, { status: 410 })
    }
    if (convite.invalidado_em) {
      return NextResponse.json({ error: 'Convite cancelado pelo administrador' }, { status: 410 })
    }
    if (new Date(convite.expira_em).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Convite expirado. Solicite um novo ao administrador.' }, { status: 410 })
    }

    // 2. Gera link de recovery do Supabase (so AGORA, no clique de verdade)
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: convite.email,
      options: { redirectTo: `${APP_URL}/redefinir-senha` },
    })
    if (linkErr || !linkData?.properties?.action_link) {
      console.error('[convites/aceitar] generateLink:', linkErr)
      return NextResponse.json({ error: 'Falha ao gerar link de acesso' }, { status: 500 })
    }

    // 3. Marca convite como usado
    await supabase
      .from('convites')
      .update({ usado_em: new Date().toISOString() })
      .eq('id', convite.id)

    return NextResponse.json({
      ok: true,
      action_link: linkData.properties.action_link,
      nome: convite.nome,
    })
  } catch (error: any) {
    console.error('[convites/aceitar] erro:', error)
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}

// GET: so retorna metadata pra mostrar na pagina (nome do convidado).
// NAO consome o convite — apenas confirma que existe e esta valido.
export async function GET(request: NextRequest) {
  try {
    const codigo = request.nextUrl.searchParams.get('codigo')
    if (!codigo) return NextResponse.json({ error: 'codigo obrigatorio' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const { data: convite } = await supabase
      .from('convites')
      .select('nome, email, papel, criado_em, expira_em, usado_em, invalidado_em')
      .eq('codigo', codigo)
      .maybeSingle()

    if (!convite) {
      return NextResponse.json({ valido: false, motivo: 'nao_encontrado' })
    }
    if (convite.usado_em) {
      return NextResponse.json({ valido: false, motivo: 'usado', nome: convite.nome })
    }
    if (convite.invalidado_em) {
      return NextResponse.json({ valido: false, motivo: 'invalidado', nome: convite.nome })
    }
    if (new Date(convite.expira_em).getTime() < Date.now()) {
      return NextResponse.json({ valido: false, motivo: 'expirado', nome: convite.nome })
    }

    return NextResponse.json({
      valido: true,
      nome: convite.nome,
      email: convite.email,
      papel: convite.papel,
      expira_em: convite.expira_em,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 })
  }
}
