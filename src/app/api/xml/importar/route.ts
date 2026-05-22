// ============================================================
// FREIGHT-MS — POST /api/xml/importar
// Recebe ZIP com XMLs de CT-e e extrai origem/destino/peso
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import JSZip from 'jszip'

export const maxDuration = 60

const MODAL_MAP: Record<string, string> = {
  '01': 'Rodoviário', '02': 'Aéreo', '03': 'Aquaviário',
  '04': 'Ferroviário', '05': 'Dutoviário',
}

function extrairTexto(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`))
  return match?.[1]?.trim() ?? ''
}

function extrairPesoReal(xml: string): number {
  // Busca <infQ> com tpMed=Peso_Real
  const blocos = xml.match(/<infQ>[sS]*?<\/infQ>/g) ?? []
  for (const bloco of blocos) {
    if (bloco.includes('Peso_Real')) {
      const q = bloco.match(/<qCarga>([^<]*)<\/qCarga>/)
      if (q) return parseFloat(q[1]) || 0
    }
  }
  return 0
}

function extrairDadosCte(xml: string) {
  // Chave de acesso
  const chaveMatch = xml.match(/Id="CTe(\d{44})"/)
  const chave = chaveMatch?.[1] ?? ''

  // UF origem e destino
  const ufIni = extrairTexto(xml, 'UFIni')
  const ufFim = extrairTexto(xml, 'UFFim')
  const munIni = extrairTexto(xml, 'xMunIni')
  const munFim = extrairTexto(xml, 'xMunFim')

  // Destinatário — pegar xNome dentro do bloco <dest>
  const destBloco = xml.match(/<dest>[sS]*?<\/dest>/)?.[0] ?? ''
  const destNome = extrairTexto(destBloco, 'xNome')

  // Modal
  const modalCod = extrairTexto(xml, 'modal')
  const modal = MODAL_MAP[modalCod] ?? 'Rodoviário'

  // Peso real
  const pesoReal = extrairPesoReal(xml)

  return { chave, ufIni, ufFim, munIni, munFim, destNome, modal, pesoReal }
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const empresa_id = formData.get('empresa_id') as string
    const arquivo = formData.get('arquivo') as File

    if (!empresa_id || !arquivo) {
      return NextResponse.json({ error: 'empresa_id e arquivo obrigatórios' }, { status: 400 })
    }

    // Ler o ZIP
    const buffer = await arquivo.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const supabase = createSupabaseAdmin()

    let processados = 0
    let atualizados = 0
    let erros = 0

    const arquivos = Object.keys(zip.files).filter(f => f.endsWith('.xml'))
    console.log(`[xml-import] ${arquivos.length} XMLs encontrados no ZIP`)

    // Processar em lotes de 50
    const LOTE = 50
    for (let i = 0; i < arquivos.length; i += LOTE) {
      const lote = arquivos.slice(i, i + LOTE)

      await Promise.all(lote.map(async (nomeArquivo) => {
        try {
          const conteudo = await zip.files[nomeArquivo].async('string')
          const dados = extrairDadosCte(conteudo)

          if (!dados.chave) return

          const { error } = await supabase
            .from('ctes')
            .update({
              uf_origem:        dados.ufIni || undefined,
              uf_destino:       dados.ufFim || undefined,
              destinatario_nome: dados.destNome || undefined,
              modal:            dados.modal || undefined,
              peso_real:        dados.pesoReal || undefined,
            })
            .eq('empresa_id', empresa_id)
            .eq('chave_acesso', dados.chave)

          if (error) {
            console.error(`[xml-import] Erro ao atualizar ${dados.chave}:`, error.message)
            erros++
          } else {
            atualizados++
          }
          processados++
        } catch (e: any) {
          console.error(`[xml-import] Erro no arquivo ${nomeArquivo}:`, e.message)
          erros++
        }
      }))
    }

    console.log(`[xml-import] Concluído: ${atualizados} atualizados, ${erros} erros`)

    return NextResponse.json({
      message: `${atualizados} CTes atualizadas com dados do XML`,
      processados,
      atualizados,
      erros,
    })
  } catch (err: any) {
    console.error('[xml-import] Erro crítico:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
