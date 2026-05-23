import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  const { data } = await supabase
    .from('sync_logs')
    .select('finalizado_em, ctes_importados, ctes_atualizados')
    .eq('empresa_id', empresa_id)
    .eq('status', 'success')
    .not('finalizado_em', 'is', null)
    .order('finalizado_em', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ ultimo_sync: data?.finalizado_em ?? null })
}
