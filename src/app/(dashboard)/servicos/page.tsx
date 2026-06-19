'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { AMERINODE_LOGO } from '@/lib/logo'
import { parsePlanilhaServicos, ServicoRow } from '@/lib/servicos/importPlanilha'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'

type Tipo = 'Frete' | 'Coleta' | 'Motoboy'
const TIPOS: Tipo[] = ['Frete', 'Coleta', 'Motoboy']

interface Servico extends ServicoRow {
  id: string
  tipo: Tipo
  origem_planilha?: string
}

const TIPO_COLOR: Record<Tipo, { bg: string; text: string }> = {
  Frete:   { bg: '#E6F1FB', text: '#185FA5' },
  Coleta:  { bg: '#EAF3DE', text: '#3A6B12' },
  Motoboy: { bg: '#FAEEDA', text: '#854F0B' },
}

function brl(v?: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}
function dataBR(iso?: string) {
  if (!iso) return '—'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// Campos numéricos que o formulário guarda como string e converte ao salvar
const NUM_FIELDS = ['distancia_km', 'km_faturado', 'valor_km', 'valor_total', 'quantidade'] as const

export default function ServicosPage() {
  const router = useRouter()
  const { perfil, sair } = useAuth()
  const supabase = createSupabaseBrowser()
  const inputRef = useRef<HTMLInputElement>(null)

  const [menuAberto, setMenuAberto] = useState(false)
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)

  // filtros
  const [fTipo, setFTipo] = useState<'Todos' | Tipo>('Todos')
  const [fMes, setFMes] = useState('')
  const [busca, setBusca] = useState('')

  // importação
  const [tipoImport, setTipoImport] = useState<Tipo>('Motoboy')
  const [preview, setPreview] = useState<{ formato: string; linhas: ServicoRow[]; ignoradas: number; nome: string } | null>(null)
  const [importando, setImportando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // modal edição/cadastro
  const [editando, setEditando] = useState<Partial<Servico> | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('servicos').select('*').eq('empresa_id', EMPRESA_ID)
    if (fTipo !== 'Todos') q = q.eq('tipo', fTipo)
    if (fMes) q = q.eq('mes_referencia', fMes)
    const { data, error } = await q.order('data_servico', { ascending: false, nullsFirst: false }).limit(2000)
    if (error) setMsg({ tipo: 'erro', texto: 'Erro ao carregar: ' + error.message })
    setServicos((data as Servico[]) ?? [])
    setLoading(false)
  }, [supabase, fTipo, fMes])

  useEffect(() => { carregar() }, [carregar])

  // -------- importação de planilha --------
  async function aoSelecionarArquivo(file: File) {
    setMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const res = parsePlanilhaServicos(buf)
      if (res.formato === 'Desconhecido' || res.linhas.length === 0) {
        setPreview(null)
        setMsg({ tipo: 'erro', texto: 'Formato não reconhecido ou planilha sem linhas válidas. Esperado: Fechamento (OS) ou Conferência (Controle).' })
        return
      }
      setPreview({ formato: res.formato, linhas: res.linhas, ignoradas: res.ignoradas, nome: file.name })
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao ler arquivo: ' + e.message })
    }
  }

  async function confirmarImportacao() {
    if (!preview) return
    setImportando(true)
    setMsg(null)
    const registros = preview.linhas.map(l => ({
      ...l,
      empresa_id: EMPRESA_ID,
      tipo: tipoImport,
      origem_planilha: preview.formato,
    }))
    let inseridos = 0
    let erro: string | null = null
    const LOTE = 200
    for (let i = 0; i < registros.length; i += LOTE) {
      const lote = registros.slice(i, i + LOTE)
      const { error } = await supabase.from('servicos').insert(lote)
      if (error) { erro = error.message; break }
      inseridos += lote.length
    }
    setImportando(false)
    if (erro) {
      setMsg({ tipo: 'erro', texto: `Importou ${inseridos} antes de falhar: ${erro}` })
    } else {
      setMsg({ tipo: 'ok', texto: `${inseridos} serviço(s) importado(s) como ${tipoImport}.` })
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
      carregar()
    }
  }

  // -------- salvar (editar/cadastrar) --------
  async function salvar() {
    if (!editando) return
    const payload: Record<string, any> = { ...editando }
    NUM_FIELDS.forEach(f => {
      if (payload[f] === '' || payload[f] == null) { payload[f] = null }
      else if (typeof payload[f] === 'string') {
        const n = parseFloat(String(payload[f]).replace(/\./g, '').replace(',', '.'))
        payload[f] = isFinite(n) ? n : null
      }
    })
    if (payload.data_servico) payload.mes_referencia = String(payload.data_servico).slice(0, 7)

    const { id, ...campos } = payload
    let error
    if (id) {
      ;({ error } = await supabase.from('servicos').update(campos).eq('id', id))
    } else {
      campos.empresa_id = EMPRESA_ID
      if (!campos.tipo) campos.tipo = 'Motoboy'
      ;({ error } = await supabase.from('servicos').insert(campos))
    }
    if (error) { setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message }); return }
    setMsg({ tipo: 'ok', texto: id ? 'Serviço atualizado.' : 'Serviço cadastrado.' })
    setEditando(null)
    carregar()
  }

  async function excluir(s: Servico) {
    if (!confirm(`Excluir o serviço ${s.os_controle || ''}?`)) return
    const { error } = await supabase.from('servicos').delete().eq('id', s.id)
    if (error) { setMsg({ tipo: 'erro', texto: 'Erro ao excluir: ' + error.message }); return }
    carregar()
  }

  // -------- filtro de texto (client-side) --------
  const filtrados = servicos.filter(s => {
    if (!busca.trim()) return true
    const t = busca.toLowerCase()
    return [s.os_controle, s.base, s.cliente, s.solicitante, s.destino_descricao, s.destino_cidade, s.chamados]
      .some(v => (v ?? '').toLowerCase().includes(t))
  })
  const totalValor = filtrados.reduce((a, s) => a + (s.valor_total ?? 0), 0)
  const totalQtde = filtrados.reduce((a, s) => a + (s.quantidade ?? 0), 0)

  // meses disponíveis para o filtro
  const meses = Array.from(new Set(servicos.map(s => s.mes_referencia).filter(Boolean))).sort().reverse() as string[]

  const TABS = [
    { label: 'CT-e', href: '/dashboard' },
    { label: 'Mapeamento', href: '/mapeamento' },
    { label: 'Serviços', href: '/servicos' },
    { label: 'Relatórios', href: '/relatorios' },
    { label: 'Alertas', href: '/alertas' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: 'var(--font-sans)' }}>
      {/* HEADER */}
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={AMERINODE_LOGO} alt="Amerinode" style={{ height: '24px', width: 'auto' }} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8', letterSpacing: '-0.3px' }}>Gestão de Log</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {TABS.map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer',
                background: tab.href === '/servicos' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: tab.href === '/servicos' ? '#F0EEE8' : '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuAberto(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid #333', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#F0EEE8', fontSize: '12px' }}>
            <span>👤</span>
            <span>{perfil?.nome || perfil?.email?.split('@')[0] || 'Usuário'}</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▾</span>
          </button>
          {menuAberto && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', borderRadius: '10px', border: '1px solid #E8E6E0', boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: '180px', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EEE8' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1916' }}>{perfil?.nome || 'Usuário'}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{perfil?.email}</div>
              </div>
              <button onClick={() => router.push('/alterar-senha')}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916' }}>
                🔑 Alterar senha
              </button>
              <button onClick={() => { setMenuAberto(false); sair() }}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#C62828', borderTop: '1px solid #F0EEE8' }}>
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ padding: '20px 32px', maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 600, color: '#1A1916', margin: '0 0 2px' }}>Serviços — Frete, Coleta e Motoboy</h1>
            <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>Importe as planilhas de fechamento/conferência ou cadastre manualmente</p>
          </div>
          <button onClick={() => setEditando({ tipo: 'Motoboy' })}
            style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Novo serviço
          </button>
        </div>

        {msg && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: msg.tipo === 'ok' ? '#EAF3DE' : '#FCEBEB', color: msg.tipo === 'ok' ? '#27500A' : '#791F1F',
            border: `0.5px solid ${msg.tipo === 'ok' ? '#B3D48A' : '#E8AEAE'}` }}>
            {msg.texto}
          </div>
        )}

        {/* IMPORTAÇÃO */}
        <div style={{ background: '#fff', border: '0.5px solid #E2E0D8', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1916', marginBottom: 10 }}>📥 Importar planilha (.xlsx)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#666' }}>Tipo desta planilha:</span>
              {TIPOS.map(t => (
                <button key={t} onClick={() => setTipoImport(t)}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: `1px solid ${tipoImport === t ? '#185FA5' : '#D4D2CA'}`,
                    background: tipoImport === t ? TIPO_COLOR[t].bg : '#fff',
                    color: tipoImport === t ? TIPO_COLOR[t].text : '#888', fontWeight: tipoImport === t ? 600 : 400 }}>
                  {t}
                </button>
              ))}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls"
              onChange={e => e.target.files?.[0] && aoSelecionarArquivo(e.target.files[0])}
              style={{ fontSize: 12 }} />
          </div>

          {preview && (
            <div style={{ marginTop: 12, padding: 12, background: '#F7F6F2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#444' }}>
                <strong>{preview.nome}</strong> — formato <strong>{preview.formato}</strong> ·{' '}
                <strong>{preview.linhas.length}</strong> linha(s) válida(s){preview.ignoradas ? ` · ${preview.ignoradas} ignorada(s)` : ''} ·
                serão importadas como <strong style={{ color: TIPO_COLOR[tipoImport].text }}>{tipoImport}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = '' }}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, border: '1px solid #D4D2CA', background: '#fff', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={confirmarImportacao} disabled={importando}
                  style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', color: '#fff', cursor: 'pointer', background: '#27500A', opacity: importando ? 0.6 : 1 }}>
                  {importando ? 'Importando…' : `Importar ${preview.linhas.length}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <select value={fTipo} onChange={e => setFTipo(e.target.value as any)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D4D2CA', fontSize: 12, background: '#fff' }}>
            <option value="Todos">Todos os tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fMes} onChange={e => setFMes(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D4D2CA', fontSize: 12, background: '#fff' }}>
            <option value="">Todos os meses</option>
            {meses.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar OS, base, cliente, chamado…"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D4D2CA', fontSize: 12, flex: 1, minWidth: 200 }} />
          <div style={{ fontSize: 12, color: '#666' }}>
            <strong>{filtrados.length}</strong> serviço(s) · {totalQtde} chamado(s) · <strong>{brl(totalValor)}</strong>
          </div>
        </div>

        {/* TABELA */}
        <div style={{ background: '#fff', border: '0.5px solid #E2E0D8', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F7F6F2', color: '#666', textAlign: 'left' }}>
                  {['Tipo', 'Data', 'OS / Controle', 'Base', 'Origem → Destino', 'Veículo', 'KM', 'Qtde', 'Valor', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '0.5px solid #E2E0D8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#999' }}>Carregando…</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#999' }}>Nenhum serviço. Importe uma planilha ou cadastre um novo.</td></tr>
                ) : filtrados.map(s => {
                  const tc = TIPO_COLOR[s.tipo] ?? TIPO_COLOR.Motoboy
                  const rota = [s.origem_cidade && `${s.origem_cidade}${s.origem_uf ? '/' + s.origem_uf : ''}`,
                    s.destino_cidade ? `${s.destino_cidade}${s.destino_uf ? '/' + s.destino_uf : ''}` : s.destino_descricao]
                    .filter(Boolean).join(' → ') || s.destino_descricao || '—'
                  return (
                    <tr key={s.id} style={{ borderBottom: '0.5px solid #F0EEE8' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.text }}>{s.tipo}</span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{dataBR(s.data_servico)}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.os_controle || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{s.base || '—'}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rota}>{rota}</td>
                      <td style={{ padding: '8px 12px' }}>{s.veiculo || '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.km_faturado ?? s.distancia_km ?? '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{s.quantidade ?? '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 600 }}>{brl(s.valor_total)}</td>
                      <td style={{ padding: '8px 12px' }}>{s.status || '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setEditando(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginRight: 6 }} title="Editar">✏️</button>
                        <button onClick={() => excluir(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }} title="Excluir">🗑️</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL EDIÇÃO / CADASTRO */}
      {editando && (
        <div onClick={() => setEditando(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#1A1916' }}>
              {editando.id ? 'Editar serviço' : 'Novo serviço'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Campo label="Tipo">
                <select value={editando.tipo || 'Motoboy'} onChange={e => setEditando({ ...editando, tipo: e.target.value as Tipo })} style={inp}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo label="OS / Controle"><input value={editando.os_controle || ''} onChange={e => setEditando({ ...editando, os_controle: e.target.value })} style={inp} /></Campo>
              <Campo label="Data"><input type="date" value={editando.data_servico || ''} onChange={e => setEditando({ ...editando, data_servico: e.target.value })} style={inp} /></Campo>
              <Campo label="Base"><input value={editando.base || ''} onChange={e => setEditando({ ...editando, base: e.target.value })} style={inp} /></Campo>
              <Campo label="Cliente"><input value={editando.cliente || ''} onChange={e => setEditando({ ...editando, cliente: e.target.value })} style={inp} /></Campo>
              <Campo label="Solicitante"><input value={editando.solicitante || ''} onChange={e => setEditando({ ...editando, solicitante: e.target.value })} style={inp} /></Campo>
              <Campo label="Período"><input value={editando.periodo || ''} onChange={e => setEditando({ ...editando, periodo: e.target.value })} style={inp} /></Campo>
              <Campo label="Veículo"><input value={editando.veiculo || ''} onChange={e => setEditando({ ...editando, veiculo: e.target.value })} style={inp} /></Campo>
              <Campo label="Capital/Interior"><input value={editando.capital_interior || ''} onChange={e => setEditando({ ...editando, capital_interior: e.target.value })} style={inp} /></Campo>
              <Campo label="Cidade origem"><input value={editando.origem_cidade || ''} onChange={e => setEditando({ ...editando, origem_cidade: e.target.value })} style={inp} /></Campo>
              <Campo label="UF origem"><input value={editando.origem_uf || ''} maxLength={2} onChange={e => setEditando({ ...editando, origem_uf: e.target.value.toUpperCase() })} style={inp} /></Campo>
              <Campo label="Cidade destino"><input value={editando.destino_cidade || ''} onChange={e => setEditando({ ...editando, destino_cidade: e.target.value })} style={inp} /></Campo>
              <Campo label="UF destino"><input value={editando.destino_uf || ''} maxLength={2} onChange={e => setEditando({ ...editando, destino_uf: e.target.value.toUpperCase() })} style={inp} /></Campo>
              <Campo label="KM faturado"><input value={editando.km_faturado ?? ''} onChange={e => setEditando({ ...editando, km_faturado: e.target.value as any })} style={inp} /></Campo>
              <Campo label="Distância (km)"><input value={editando.distancia_km ?? ''} onChange={e => setEditando({ ...editando, distancia_km: e.target.value as any })} style={inp} /></Campo>
              <Campo label="Valor KM"><input value={editando.valor_km ?? ''} onChange={e => setEditando({ ...editando, valor_km: e.target.value as any })} style={inp} /></Campo>
              <Campo label="Quantidade"><input value={editando.quantidade ?? ''} onChange={e => setEditando({ ...editando, quantidade: e.target.value as any })} style={inp} /></Campo>
              <Campo label="Valor total"><input value={editando.valor_total ?? ''} onChange={e => setEditando({ ...editando, valor_total: e.target.value as any })} style={inp} /></Campo>
              <Campo label="Status"><input value={editando.status || ''} onChange={e => setEditando({ ...editando, status: e.target.value })} style={inp} /></Campo>
            </div>
            <Campo label="Rota / descrição destino"><input value={editando.destino_descricao || ''} onChange={e => setEditando({ ...editando, destino_descricao: e.target.value })} style={inp} /></Campo>
            <Campo label="Chamados"><input value={editando.chamados || ''} onChange={e => setEditando({ ...editando, chamados: e.target.value })} style={inp} /></Campo>
            <Campo label="Observação"><textarea value={editando.observacao || ''} onChange={e => setEditando({ ...editando, observacao: e.target.value })} style={{ ...inp, minHeight: 56, resize: 'vertical' }} /></Campo>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setEditando(null)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid #D4D2CA', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: '#185FA5', color: '#fff', cursor: 'pointer' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid #D4D2CA', fontSize: 12, marginTop: 3 }

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, color: '#666', marginTop: 8 }}>
      {label}
      {children}
    </label>
  )
}
