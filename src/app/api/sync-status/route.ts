import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  // Pegar o log mais recente que foi finalizado (qualquer status exceto running)
  const { data } = await supabase
    .from('sync_logs')
    .select('finalizado_em, status, ctes_importados, ctes_atualizados')
    .eq('empresa_id', empresa_id)
    .not('finalizado_em', 'is', null)
    .order('finalizado_em', { ascending: false })
    .limit(1)

  const ultimo = data?.[0]

  return NextResponse.json({
    ultimo_sync: ultimo?.finalizado_em ?? null,
    importados: ultimo?.ctes_importados ?? 0,
    atualizados: ultimo?.ctes_atualizados ?? 0,
    status: ultimo?.status ?? null,
  })
}
