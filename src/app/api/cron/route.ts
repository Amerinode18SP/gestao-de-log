// ============================================================
// FREIGHT-MS - Cron Job: Sync automático diário
// Chamado pelo GitHub Actions todo dia às 00:00 BRT
// ============================================================
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const empresa_id = process.env.NEXT_PUBLIC_EMPRESA_ID
  if (!empresa_id) {
    return NextResponse.json({ error: 'EMPRESA_ID não configurado' }, { status: 500 })
  }

  try {
    console.log('[CRON] Iniciando sync automático -', new Date().toISOString())

    // URL fixa do sistema em produção
    const baseUrl = 'https://gestao-de-frete.vercel.app'

    const res = await fetch(`${baseUrl}/api/omie/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id }),
    })

    const data = await res.json()

    console.log('[CRON] Sync concluído:', JSON.stringify(data))

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      resultado: data,
    })
  } catch (error: any) {
    console.error('[CRON] Erro:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
