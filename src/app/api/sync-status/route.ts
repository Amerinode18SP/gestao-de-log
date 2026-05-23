import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('sync_logs')
    .select('finalizado_em')
    .eq('empresa_id', empresa_id)
    .eq('status', 'success')
    .not('finalizado_em', 'is', null)
    .order('finalizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log('[sync-status] data:', data, 'error:', error)

  return NextResponse.json(
    { ultimo_sync: data?.finalizado_em ?? null },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
