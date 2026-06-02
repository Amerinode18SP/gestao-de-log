// Diag: ve se RESEND_API_KEY esta presente no Vercel
import { NextResponse } from 'next/server'

export async function GET() {
  const k = process.env.RESEND_API_KEY
  return NextResponse.json({
    tem_resend_key: !!k,
    inicio_da_key: k ? k.slice(0, 6) + '...' : null,
    tamanho: k?.length ?? 0,
  })
}
