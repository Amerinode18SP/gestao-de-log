// Diag: tenta enviar email de teste e mostra resposta do Resend
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to') || 'compras@amerinode.com.br'
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ erro: 'sem RESEND_API_KEY' }, { status: 500 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Gestão de Log - Amerinode <gestao-de-log@amerinode.com.br>',
      to: [to],
      subject: 'Teste — ' + new Date().toLocaleTimeString('pt-BR'),
      html: '<p>Teste de envio</p>',
    }),
  })
  const body = await res.text()
  return NextResponse.json({
    http_status: res.status,
    inicio_da_key: apiKey.slice(0, 6) + '...',
    resposta_resend: body.slice(0, 500),
  })
}
