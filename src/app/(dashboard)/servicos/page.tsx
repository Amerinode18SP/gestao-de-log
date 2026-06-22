'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AMERINODE_LOGO } from '@/lib/logo'
import { parsePlanilhaServicos, ServicoRow } from '@/lib/servicos/importPlanilha'
import ServicosDashboard from './Dashboard'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'

type Tipo = 'Frete' | 'Coleta' | 'Motoboy'
const TIPOS: Tipo[] = ['Frete', 'Coleta', 'Motoboy']

interface Servico extends ServicoRow {
  id: string
  tipo: Tipo
  origem_planilha?: string
  fornecedor?: string
}

const LS_FORNECEDOR = 'servicos_fornecedor_padrao'

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
  const inputRef = useRef<HTMLInputElement>(null)

  const [menuAberto, setMenuAberto] = useState(false)
  const [aba, setAba] = useState<'lista' | 'painel'>('lista')
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)

  // filtros
  const [busca, setBusca] = useState('')
  const [colF, setColF] = useState({
    tipo: 'Todos', fornecedor: 'Todos', mes: 'Todos', periodo: 'Todos',
    fds: 'Todos', veiculo: 'Todos', os: '', chamado: '',
  })
  const setCol = (campo: keyof typeof colF, v: string) => setColF(f => ({ ...f, [campo]: v }))

  // paginação
  const PAGE_SIZE = 500
  const [pagina, setPagina] = useState(0)

  // importação
  const [tipoImport, setTipoImport] = useState<Tipo>('Motoboy')
  const [fornecedorImport, setFornecedorImport] = useState('')
  const [preview, setPreview] = useState<{ formato: string; linhas: ServicoRow[]; ignoradas: number; nome: string } | null>(null)
  const [importando, setImportando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // modal edição/cadastro
  const [editando, setEditando] = useState<Partial<Servico> | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      // all=1 traz TODOS os registros (paginado no servidor), sem o cap de 2000
      const res = await fetch('/api/servicos?all=1&empresa_id=' + EMPRESA_ID)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar')
      setServicos((json.servicos as Servico[]) ?? [])
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao carregar: ' + (e?.message || e) })
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Recupera o fornecedor padrão salvo na última importação
  useEffect(() => {
    try { const v = localStorage.getItem(LS_FORNECEDOR); if (v) setFornecedorImport(v) } catch {}
  }, [])

  // -------- importação de planilha --------
  const [lendo, setLendo] = useState(false)
  async function aoSelecionarArquivo(file: File) {
    setMsg(null)
    setPreview(null)
    setLendo(true)
    try {
      const buf = await file.arrayBuffer()
      const res = parsePlanilhaServicos(buf)
      if (res.formato === 'Desconhecido' || res.linhas.length === 0) {
        setMsg({ tipo: 'erro', texto: `Não reconheci "${file.name}". Esperado: planilha de Fechamento (coluna OS) ou Conferência (coluna Controle). Detectado: ${res.formato}, ${res.linhas.length} linha(s).` })
        return
      }
      setPreview({ formato: res.formato, linhas: res.linhas, ignoradas: res.ignoradas, nome: file.name })
    } catch (e: any) {
      console.error('[servicos] erro ao ler planilha:', e)
      setMsg({ tipo: 'erro', texto: 'Erro ao ler arquivo: ' + (e?.message || e) })
    } finally {
      setLendo(false)
    }
  }

  async function confirmarImportacao() {
    if (!preview) return
    setImportando(true)
    setMsg(null)
    const forn = fornecedorImport.trim()
    const registros = preview.linhas.map(l => ({
      ...l,
      tipo: tipoImport,
      origem_planilha: preview.formato,
      fornecedor: forn || undefined,
    }))
    try {
      if (forn) { try { localStorage.setItem(LS_FORNECEDOR, forn) } catch {} }
      const res = await fetch('/api/servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID, registros, dedup: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha na importação')
      const dup = json.duplicados
        ? ` ${json.duplicados} duplicado(s) ignorado(s).`
        : ''
      setMsg({ tipo: 'ok', texto: `${json.inseridos} serviço(s) importado(s) como ${tipoImport}.${dup}` })
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
      carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro na importação: ' + (e?.message || e) })
    }
    setImportando(false)
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
    try {
      let res: Response
      if (id) {
        res = await fetch('/api/servicos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, empresa_id: EMPRESA_ID, campos }),
        })
      } else {
        res = await fetch('/api/servicos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa_id: EMPRESA_ID, registros: [campos] }),
        })
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar')
      setMsg({ tipo: 'ok', texto: id ? 'Serviço atualizado.' : 'Serviço cadastrado.' })
      setEditando(null)
      carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + (e?.message || e) })
    }
  }

  async function excluir(s: Servico) {
    if (!confirm(`Excluir o serviço ${s.os_controle || ''}?`)) return
    try {
      const p = new URLSearchParams({ id: s.id, empresa_id: EMPRESA_ID })
      const res = await fetch('/api/servicos?' + p.toString(), { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir')
      carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: 'Erro ao excluir: ' + (e?.message || e) })
    }
  }

  // -------- filtros (client-side): busca global + filtros por coluna --------
  const filtrados = servicos.filter(s => {
    if (colF.tipo !== 'Todos' && s.tipo !== colF.tipo) return false
    if (colF.fornecedor !== 'Todos' && (s.fornecedor || '') !== colF.fornecedor) return false
    if (colF.mes !== 'Todos' && (s.mes_referencia || '') !== colF.mes) return false
    if (colF.periodo !== 'Todos' && (s.periodo || '') !== colF.periodo) return false
    if (colF.fds !== 'Todos' && (s.fds_feriado ? 'Sim' : 'Não') !== colF.fds) return false
    if (colF.veiculo !== 'Todos' && (s.veiculo || '') !== colF.veiculo) return false
    if (colF.os && !(s.os_controle || '').toLowerCase().includes(colF.os.toLowerCase())) return false
    if (colF.chamado && !(s.chamados || '').toLowerCase().includes(colF.chamado.toLowerCase())) return false
    if (busca.trim()) {
      const t = busca.toLowerCase()
      const ok = [s.os_controle, s.base, s.cliente, s.solicitante, s.fornecedor, s.destino_descricao, s.destino_cidade, s.chamados]
        .some(v => (v ?? '').toLowerCase().includes(t))
      if (!ok) return false
    }
    return true
  })
  // totais sobre TODO o conjunto filtrado (não só a página atual)
  const totalValor = filtrados.reduce((a, s) => a + (s.valor_total ?? 0), 0)
  const totalQtde = filtrados.reduce((a, s) => a + (s.quantidade ?? 0), 0)

  // opções dos selects do cabeçalho
  const meses = Array.from(new Set(servicos.map(s => s.mes_referencia).filter(Boolean))).sort().reverse() as string[]
  const fornecedores = Array.from(new Set(servicos.map(s => s.fornecedor).filter(Boolean))).sort() as string[]
  const veiculos = Array.from(new Set(servicos.map(s => s.veiculo).filter(Boolean))).sort() as string[]
  const periodos = Array.from(new Set(servicos.map(s => s.periodo).filter(Boolean))).sort() as string[]

  // paginação (500/página) sobre o conjunto filtrado
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const pAtual = Math.min(pagina, totalPaginas - 1)
  const inicioIdx = pAtual * PAGE_SIZE
  const pageRows = filtrados.slice(inicioIdx, inicioIdx + PAGE_SIZE)
  // volta para a 1ª página sempre que os filtros mudam
  useEffect(() => { setPagina(0) }, [busca, colF])

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
          {aba === 'lista' && (
            <button onClick={() => setEditando({ tipo: 'Motoboy' })}
              style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + Novo serviço
            </button>
          )}
        </div>

        {/* SUB-ABAS: Lista / Painel */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #E2E0D8' }}>
          {([['lista', '📋 Lista'], ['painel', '📊 Painel']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setAba(k)}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: aba === k ? 600 : 400, cursor: 'pointer',
                background: 'none', border: 'none', color: aba === k ? '#185FA5' : '#888',
                borderBottom: `2px solid ${aba === k ? '#185FA5' : 'transparent'}`, marginBottom: -1 }}>
              {lbl}
            </button>
          ))}
        </div>

        {msg && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: msg.tipo === 'ok' ? '#EAF3DE' : '#FCEBEB', color: msg.tipo === 'ok' ? '#27500A' : '#791F1F',
            border: `0.5px solid ${msg.tipo === 'ok' ? '#B3D48A' : '#E8AEAE'}` }}>
            {msg.texto}
          </div>
        )}

        {aba === 'painel' && <ServicosDashboard />}

        {aba === 'lista' && (<>
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
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#666' }}>Fornecedor:</span>
              <input value={fornecedorImport} onChange={e => setFornecedorImport(e.target.value)}
                placeholder="nome do fornecedor"
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D4D2CA', fontSize: 12, minWidth: 180 }} />
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls"
              onChange={e => { const f = e.target.files?.[0]; if (f) aoSelecionarArquivo(f) }}
              style={{ display: 'none' }} />
            <button onClick={() => inputRef.current?.click()} disabled={lendo}
              style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: lendo ? 0.6 : 1 }}>
              {lendo ? 'Lendo…' : '📂 Selecionar planilha'}
            </button>
          </div>

          {preview && (
            <div style={{ marginTop: 12, padding: 12, background: '#F7F6F2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#444' }}>
                <strong>{preview.nome}</strong> — formato <strong>{preview.formato}</strong> ·{' '}
                <strong>{preview.linhas.length}</strong> linha(s) válida(s){preview.ignoradas ? ` · ${preview.ignoradas} ignorada(s)` : ''} ·
                serão importadas como <strong style={{ color: TIPO_COLOR[tipoImport].text }}>{tipoImport}</strong>
                {fornecedorImport.trim() ? <> · fornecedor <strong>{fornecedorImport.trim()}</strong></> : ''}
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

        {/* BUSCA + TOTAIS + PAGINAÇÃO */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar OS, base, cliente, chamado…"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D4D2CA', fontSize: 12, flex: 1, minWidth: 200 }} />
          <div style={{ fontSize: 12, color: '#666' }}>
            <strong>{filtrados.length}</strong> serviço(s) · {totalQtde} chamado(s) · <strong>{brl(totalValor)}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button disabled={pAtual === 0} onClick={() => setPagina(0)} style={pgBtn(pAtual === 0)}>⏮ Início</button>
            <button disabled={pAtual === 0} onClick={() => setPagina(p => Math.max(0, p - 1))} style={pgBtn(pAtual === 0)}>◀ Voltar</button>
            <span style={{ fontSize: 12, color: '#666', minWidth: 150, textAlign: 'center' }}>
              Pág. {pAtual + 1}/{totalPaginas} · {filtrados.length ? inicioIdx + 1 : 0}–{Math.min(inicioIdx + PAGE_SIZE, filtrados.length)} de {filtrados.length}
            </span>
            <button disabled={pAtual >= totalPaginas - 1} onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} style={pgBtn(pAtual >= totalPaginas - 1)}>Próximo ▶</button>
            <button disabled={pAtual >= totalPaginas - 1} onClick={() => setPagina(totalPaginas - 1)} style={pgBtn(pAtual >= totalPaginas - 1)}>Fim ⏭</button>
          </div>
        </div>

        {/* TABELA */}
        <div style={{ background: '#fff', border: '0.5px solid #E2E0D8', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ color: '#666', textAlign: 'left' }}>
                  {['Tipo', 'Fornecedor', 'Data', 'Horário', 'Período', 'FDS/Fer.', 'Valor KM', 'OS / Controle', 'Origem → Destino', 'Endereço destino', 'Veículo', 'KM', 'Qtde', 'Chamado', 'Valor', ''].map((h, i) => (
                    <th key={i} style={{ padding: '9px 12px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '0.5px solid #E2E0D8', background: '#F7F6F2', position: 'sticky', top: 0, zIndex: 3 }}>{h}</th>
                  ))}
                </tr>
                {/* linha de filtros por coluna (estilo Excel) */}
                <tr>
                  <th style={thF}><select value={colF.tipo} onChange={e => setCol('tipo', e.target.value)} style={hf}><option value="Todos">Todos</option>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select></th>
                  <th style={thF}><select value={colF.fornecedor} onChange={e => setCol('fornecedor', e.target.value)} style={hf}><option value="Todos">Todos</option>{fornecedores.map(f => <option key={f} value={f}>{f}</option>)}</select></th>
                  <th style={thF}><select value={colF.mes} onChange={e => setCol('mes', e.target.value)} style={hf}><option value="Todos">Todos</option>{meses.map(m => <option key={m} value={m}>{m}</option>)}</select></th>
                  <th style={thF}></th>
                  <th style={thF}><select value={colF.periodo} onChange={e => setCol('periodo', e.target.value)} style={hf}><option value="Todos">Todos</option>{periodos.map(p => <option key={p} value={p}>{p}</option>)}</select></th>
                  <th style={thF}><select value={colF.fds} onChange={e => setCol('fds', e.target.value)} style={hf}><option value="Todos">Todos</option><option value="Sim">Sim</option><option value="Não">Não</option></select></th>
                  <th style={thF}></th>
                  <th style={thF}><input value={colF.os} onChange={e => setCol('os', e.target.value)} placeholder="filtrar…" style={hf} /></th>
                  <th style={thF}></th>
                  <th style={thF}></th>
                  <th style={thF}><select value={colF.veiculo} onChange={e => setCol('veiculo', e.target.value)} style={hf}><option value="Todos">Todos</option>{veiculos.map(v => <option key={v} value={v}>{v}</option>)}</select></th>
                  <th style={thF}></th>
                  <th style={thF}></th>
                  <th style={thF}><input value={colF.chamado} onChange={e => setCol('chamado', e.target.value)} placeholder="filtrar…" style={hf} /></th>
                  <th style={thF}></th>
                  <th style={thF}><button onClick={() => setColF({ tipo: 'Todos', fornecedor: 'Todos', mes: 'Todos', periodo: 'Todos', fds: 'Todos', veiculo: 'Todos', os: '', chamado: '' })} title="Limpar filtros" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✖️</button></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={16} style={{ padding: 24, textAlign: 'center', color: '#999' }}>Carregando…</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={16} style={{ padding: 24, textAlign: 'center', color: '#999' }}>Nenhum serviço encontrado com os filtros atuais.</td></tr>
                ) : pageRows.map(s => {
                  const tc = TIPO_COLOR[s.tipo] ?? TIPO_COLOR.Motoboy
                  const rota = [s.origem_cidade && `${s.origem_cidade}${s.origem_uf ? '/' + s.origem_uf : ''}`,
                    s.destino_cidade ? `${s.destino_cidade}${s.destino_uf ? '/' + s.destino_uf : ''}` : s.destino_descricao]
                    .filter(Boolean).join(' → ') || s.destino_descricao || '—'
                  return (
                    <tr key={s.id} style={{ borderBottom: '0.5px solid #F0EEE8' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.text }}>{s.tipo}</span>
                      </td>
                      <td style={{ padding: '8px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.fornecedor || ''}>{s.fornecedor || '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{dataBR(s.data_servico)}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.hora_saida || '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.periodo || '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.fds_feriado ? 'Sim' : '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.valor_km != null ? brl(s.valor_km) : '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.os_controle || '—'}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rota}>{rota}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.destino_endereco || ''}>{s.destino_endereco || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{s.veiculo || '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.km_faturado ?? s.distancia_km ?? '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{s.quantidade ?? '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }} title={s.chamados || ''}>{s.chamados || '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 600 }}>{brl(s.valor_total)}</td>
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
        </>)}
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
              <Campo label="Fornecedor"><input value={editando.fornecedor || ''} onChange={e => setEditando({ ...editando, fornecedor: e.target.value })} style={inp} /></Campo>
              <Campo label="OS / Controle"><input value={editando.os_controle || ''} onChange={e => setEditando({ ...editando, os_controle: e.target.value })} style={inp} /></Campo>
              <Campo label="Data"><input type="date" value={editando.data_servico || ''} onChange={e => setEditando({ ...editando, data_servico: e.target.value })} style={inp} /></Campo>
              <Campo label="Horário (abertura)"><input value={editando.hora_saida || ''} onChange={e => setEditando({ ...editando, hora_saida: e.target.value })} style={inp} /></Campo>
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
              <Campo label="Endereço destino"><input value={editando.destino_endereco || ''} onChange={e => setEditando({ ...editando, destino_endereco: e.target.value })} style={inp} /></Campo>
              <Campo label="FDS/Feriado">
                <select value={editando.fds_feriado ? 'sim' : 'nao'} onChange={e => setEditando({ ...editando, fds_feriado: e.target.value === 'sim' })} style={inp}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Campo>
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

// filtros do cabeçalho da tabela (estilo Excel)
const thF: React.CSSProperties = { padding: '4px 8px', background: '#F7F6F2', borderBottom: '0.5px solid #E2E0D8', position: 'sticky', top: 33, zIndex: 2 }
const hf: React.CSSProperties = { width: '100%', padding: '3px 5px', borderRadius: 5, border: '1px solid #D4D2CA', fontSize: 10, background: '#fff' }
const pgBtn = (d: boolean): React.CSSProperties => ({ padding: '5px 10px', borderRadius: 7, border: '1px solid #D4D2CA', background: '#fff', fontSize: 12, cursor: d ? 'default' : 'pointer', opacity: d ? 0.4 : 1 })

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, color: '#666', marginTop: 8 }}>
      {label}
      {children}
    </label>
  )
}
