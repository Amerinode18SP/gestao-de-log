'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import MapeamentoPage from '../mapeamento/page'
import RelatoriosPage from '../relatorios/page'
import AlertasPage from '../alertas/page'

interface SyncStatus {
  running: boolean
  pagina: number
  total: number
  importados: number
  atualizados: number
  erro?: string
  concluido: boolean
}

interface ResolverStatus {
  running: boolean
  resolvidos: number
  ainda_pendentes: number
  concluido: boolean
  erro?: string
}

interface Resumo {
  total: number
  faturado: number
  cancelado: number
  pendente: number
  valor_total: number
}

interface Cte {
  id: string
  numero_cte: string
  remetente_nome: string
  fornecedor_nome: string
  destinatario_nome: string
  uf_origem: string
  uf_destino: string
  valor_servico: number
  status: string
  data_emissao: string
  modal: string
  chave_acesso: string
  peso_real: number
  centro_custo_nome: string
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Faturado:   { bg: '#E8F5E9', color: '#2E7D32' },
  Cancelado:  { bg: '#FFEBEE', color: '#C62828' },
  Pendente:   { bg: '#FFF8E1', color: '#E65100' },
  'A vencer': { bg: '#FFF8E1', color: '#E65100' },
}

export default function DashboardPage() {
  const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? ''
  const router = useRouter()
  const { isAdmin, perfil, sair } = useAuth()
  const PAGE_SIZE = 50

  const [resolver, setResolver] = useState<ResolverStatus>({
    running: false, resolvidos: 0, ainda_pendentes: 0, concluido: false
  })
  const [sync, setSync] = useState<SyncStatus>({
    running: false, pagina: 0, total: 0,
    importados: 0, atualizados: 0, concluido: false,
  })
  const [xmlImport, setXmlImport] = useState<{ running: boolean; mensagem: string; erro?: string }>({
    running: false, mensagem: ''
  })
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [ctes, setCtes] = useState<Cte[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [carregando, setCarregando] = useState(true)
  const [menuAberto, setMenuAberto] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCtes, setTotalCtes] = useState(0)
  const [ultimoSync, setUltimoSync] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  // sub-abas internas do CT-e
  const [sub, setSub] = useState<'cte' | 'mapeamento' | 'relatorios' | 'alertas'>('cte')
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'mapeamento' || t === 'relatorios' || t === 'alertas') setSub(t)
  }, [])

  const carregarCtes = useCallback(async (p = 1, status = 'Todos', q = '', di = '', df = '') => {
    setCarregando(true)
    try {
      const params = new URLSearchParams({
        empresa_id: EMPRESA_ID,
        page: String(p),
        limit: String(PAGE_SIZE),
      })
      if (status !== 'Todos') params.set('status', status === 'A vencer' ? 'Pendente' : status)
      if (q) params.set('busca', q)
      if (di) params.set('data_inicio', di)
      if (df) params.set('data_fim', df)

      const res = await fetch(`/api/ctes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCtes(data.ctes ?? [])
        setTotalPages(data.total_pages ?? 1)
        setTotalCtes(data.total ?? 0)
        setPage(p)
      }
    } catch (e) { console.error(e) }
    setCarregando(false)
  }, [EMPRESA_ID])

  const carregarResumo = useCallback(async (status = 'Todos', q = '', di = '', df = '') => {
    const params = new URLSearchParams({ empresa_id: EMPRESA_ID })
    if (status !== 'Todos') params.set('status', status === 'A vencer' ? 'Pendente' : status)
    if (q) params.set('busca', q)
    if (di) params.set('data_inicio', di)
    if (df) params.set('data_fim', df)
    const res = await fetch(`/api/ctes/resumo?${params}`)
    if (res.ok) setResumo(await res.json())
  }, [EMPRESA_ID])

  const carregarUltimoSync = useCallback(async (forcarData?: string) => {
    if (forcarData) {
      setUltimoSync(forcarData)
      return
    }
    try {
      const res = await fetch(`/api/sync-status?empresa_id=${EMPRESA_ID}`)
      if (res.ok) {
        const data = await res.json()
        if (data.ultimo_sync) setUltimoSync(data.ultimo_sync)
      }
    } catch (e) { console.error(e) }
  }, [EMPRESA_ID])

  useEffect(() => {
    carregarResumo('Todos', '')
    carregarCtes(1, 'Todos', '')
    carregarUltimoSync()
  }, [carregarResumo, carregarCtes, carregarUltimoSync])

  useEffect(() => {
    const t = setTimeout(() => {
      carregarResumo(filtroStatus, busca, dataInicio, dataFim)
      carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
    }, 400)
    return () => clearTimeout(t)
  }, [busca, filtroStatus, dataInicio, dataFim, carregarCtes, carregarResumo])


  const verificarAlertas = async () => {
    try {
      await fetch('/api/alertas/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID }),
      })
    } catch (e) { console.error('Erro ao verificar alertas:', e) }
  }

  // Sync rapido — processa MAX_LOTES de 20 paginas cada (=1000 conta-pagar
  // mais recentes por lote). Com ordenar_por=DATA_EMISSAO desc, isso cobre
  // as CTes dos ultimos meses sem disparar rate limit da Omie.
  const MAX_LOTES = 3  // 3 lotes * 20 paginas * 50 entries = ~3000 contas recentes
  const iniciarSync = async () => {
    setSync({ running: true, pagina: 1, total: 0, importados: 0, atualizados: 0, concluido: false })
    let pagina = 1
    let totalImportados = 0
    let totalAtualizados = 0
    let loteAtual = 0
    try {
      while (loteAtual < MAX_LOTES) {
        loteAtual++
        const res = await fetch('/api/omie/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer interno' },
          body: JSON.stringify({ empresa_id: EMPRESA_ID, pagina_inicio: pagina }),
        })
        if (!res.ok) {
          const err = await res.json()
          setSync(s => ({ ...s, running: false, erro: err.error ?? 'Erro no servidor' }))
          return
        }
        const data = await res.json()
        totalImportados  += data.importados ?? 0
        totalAtualizados += data.atualizados ?? 0

        // Se backend retornou alerta de rate limit, para imediatamente
        const rateLimitSegundos = data.rate_limit_aguardar_segundos
        if (rateLimitSegundos) {
          setSync({
            running: false,
            pagina: data.proxima_pagina ?? pagina,
            total: data.total_paginas ?? 0,
            importados: totalImportados,
            atualizados: totalAtualizados,
            concluido: false,
            erro: `Omie pediu pausa de ${rateLimitSegundos}s. Importados ${totalImportados} novos ate aqui. Aguarde ${Math.ceil(rateLimitSegundos/60)}min e clique em Sincronizar de novo pra continuar.`,
          })
          break
        }

        const concluiu = !data.proxima_pagina
        const limiteAtingido = loteAtual >= MAX_LOTES && !concluiu

        setSync({
          running: !concluiu && !limiteAtingido,
          pagina: data.proxima_pagina ?? pagina,
          total: data.total_paginas ?? 0,
          importados: totalImportados,
          atualizados: totalAtualizados,
          concluido: concluiu,
          erro: limiteAtingido
            ? `Importados ${totalImportados} novos das ${loteAtual * 20} paginas mais recentes. Pra continuar buscando historico antigo, clique em Sincronizar de novo.`
            : undefined,
        })
        if (concluiu) break
        pagina = data.proxima_pagina
        // Pausa entre lotes para Omie respirar
        await new Promise(r => setTimeout(r, 2000))
      }
      await carregarResumo(filtroStatus, busca, dataInicio, dataFim)
      await carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
      await carregarUltimoSync(new Date().toISOString())
      await resolverTransportadoras()
      await verificarAlertas()
    } catch (e: any) {
      setSync(s => ({ ...s, running: false, erro: e.message }))
    }
  }

  const resolverTransportadoras = async () => {
    setResolver({ running: true, resolvidos: 0, ainda_pendentes: 0, concluido: false })
    let totalResolvidos = 0
    const MAX_TENTATIVAS = 20
    try {
      for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
        const res = await fetch('/api/omie/resolver-transportadoras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer interno' },
          body: JSON.stringify({ empresa_id: EMPRESA_ID }),
        })
        if (!res.ok) {
          const err = await res.json()
          setResolver(s => ({ ...s, running: false, erro: err.error ?? 'Erro' }))
          return
        }
        const data = await res.json()
        totalResolvidos += data.resolvidos ?? 0
        setResolver({
          running:         data.tem_mais ?? false,
          resolvidos:      totalResolvidos,
          ainda_pendentes: data.ainda_pendentes ?? 0,
          concluido:       !data.tem_mais,
        })
        if (!data.tem_mais) break
        if ((data.resolvidos ?? 0) === 0) break
        await new Promise(r => setTimeout(r, 800))
      }
      setResolver(s => ({ ...s, running: false, concluido: true }))
      await carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
    } catch (e: any) {
      setResolver(s => ({ ...s, running: false, erro: e.message }))
    }
  }

  const importarXml = async (arquivo: File) => {
    setXmlImport({ running: true, mensagem: 'Processando XMLs...' })
    try {
      const formData = new FormData()
      formData.append('empresa_id', EMPRESA_ID)
      formData.append('arquivo', arquivo)
      const res = await fetch('/api/xml/importar', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer interno' },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao importar')
      setXmlImport({ running: false, mensagem: data.message })
      await carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
    } catch (e: any) {
      setXmlImport({ running: false, mensagem: '', erro: e.message })
    }
  }

  const progresso = sync.total > 0 ? Math.round((sync.pagina / sync.total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: 'var(--font-sans)', color: '#1A1916' }}>
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="data:image/png;base64,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" alt="Amerinode" style={{ height: '24px', width: 'auto' }} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8', letterSpacing: '-0.3px' }}>Gestão de Log</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'CT-e', href: '/ct-e' }, { label: 'Serviços', href: '/servicos' }].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: tab.href === '/ct-e' ? 'rgba(255,255,255,0.12)' : 'transparent', color: tab.href === '/ct-e' ? '#F0EEE8' : '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {sub === 'cte' && ultimoSync && (
            <span style={{ fontSize: '11px', color: '#888', background: '#2a2a2a', padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
              🕐 Último sync: {new Date(ultimoSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {sub === 'cte' && isAdmin && (
            <>
              <label style={{ background: xmlImport.running ? '#555' : '#1565C0', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: xmlImport.running ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {xmlImport.running ? '⟳ Importando...' : '📂 Importar XMLs'}
                <input type="file" accept=".zip" style={{ display: 'none' }} disabled={xmlImport.running} onChange={e => { const f = e.target.files?.[0]; if (f) importarXml(f); e.target.value = ''; }} />
              </label>
              <button onClick={resolverTransportadoras} disabled={resolver.running || sync.running}
                style={{ background: resolver.running ? '#555' : resolver.concluido ? '#1B5E20' : '#7B1FA2', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: resolver.running ? 'not-allowed' : 'pointer' }}>
                {resolver.running ? `⟳ Resolvendo... (${resolver.resolvidos})` : resolver.concluido ? `✅ ${resolver.resolvidos} resolvidas` : '🔍 Preencher Transportadoras'}
              </button>
              <button onClick={iniciarSync} disabled={sync.running || resolver.running}
                style={{ background: sync.running ? '#333' : '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: sync.running ? 'not-allowed' : 'pointer' }}>
                {sync.running ? `⟳ Sincronizando... ${sync.pagina}/${sync.total}` : sync.concluido ? '✅ Sincronizado' : '🔄 Sincronizar CTes'}
              </button>
            </>
          )}
          <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuAberto(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid #333', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#F0EEE8', fontSize: '12px' }}
          >
            <span>👤</span>
            <span>{perfil?.nome || perfil?.email?.split('@')[0] || 'Usuário'}</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
          </button>
          {menuAberto && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', borderRadius: '10px', border: '1px solid #E8E6E0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EEE8' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1916' }}>{perfil?.nome || 'Usuário'}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{perfil?.email}</div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', background: perfil?.papel === 'administrador' ? '#E6F1FB' : '#EAF3DE', color: perfil?.papel === 'administrador' ? '#0C447C' : '#27500A', padding: '2px 8px', borderRadius: '99px', fontWeight: '500' }}>
                    {perfil?.papel === 'administrador' ? '👑 Administrador' : '👁️ Visualizador'}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => { setMenuAberto(false); router.push('/usuarios') }}
                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    👥 Gerenciar usuários
                  </button>
                  <button onClick={() => { setMenuAberto(false); router.push('/configuracoes') }}
                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    ⚙️ Configurações
                  </button>
                </>
              )}
              <button onClick={() => router.push('/alterar-senha')}
                style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseOver={e => (e.currentTarget.style.background = '#F0EEE8')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                🔑 Alterar senha
              </button>
              <button onClick={sair}
                style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#C62828', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #F0EEE8' }}
                onMouseOver={e => (e.currentTarget.style.background = '#FFF5F5')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
        </div>
      </header>

      <main style={{ padding: '16px 24px', maxWidth: '1760px', margin: '0 auto' }}>

        {/* SUB-ABAS internas do CT-e */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #E2E0D8', flexWrap: 'wrap' }}>
          {([['cte', '📄 CT-e'], ['mapeamento', '🗺️ Mapeamento'], ['relatorios', '📊 Relatórios'], ['alertas', '🔔 Alertas']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setSub(k)}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: sub === k ? 600 : 400, cursor: 'pointer', background: 'none', border: 'none', color: sub === k ? '#185FA5' : '#888', borderBottom: `2px solid ${sub === k ? '#185FA5' : 'transparent'}`, marginBottom: -1 }}>
              {lbl}
            </button>
          ))}
        </div>

        {sub === 'mapeamento' && <MapeamentoPage embedded />}
        {sub === 'relatorios' && <RelatoriosPage embedded />}
        {sub === 'alertas' && <AlertasPage embedded />}

        {sub === 'cte' && (<>
        {(sync.running || sync.concluido || sync.erro) && (
          <div style={{ background: sync.erro ? '#FFEBEE' : sync.concluido ? '#E8F5E9' : '#E3F2FD', border: `1px solid ${sync.erro ? '#FFCDD2' : sync.concluido ? '#C8E6C9' : '#BBDEFB'}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
            {sync.erro ? <p style={{ margin: 0, color: '#C62828', fontSize: '14px' }}>❌ Erro: {sync.erro}</p>
            : sync.concluido ? <p style={{ margin: 0, color: '#2E7D32', fontSize: '14px' }}>✅ Sync concluído — <strong>{sync.importados} novos</strong>, {sync.atualizados} atualizados.</p>
            : <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#1565C0' }}>Buscando página {sync.pagina} de {sync.total || '?'} — {sync.importados} CTes importadas</span>
                  <span style={{ fontSize: '13px', color: '#1565C0', fontWeight: '600' }}>{progresso}%</span>
                </div>
                <div style={{ background: '#BBDEFB', borderRadius: '99px', height: '6px' }}>
                  <div style={{ background: '#1976D2', width: `${progresso}%`, height: '100%', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                </div>
              </div>}
          </div>
        )}

        {(resolver.running || resolver.concluido || resolver.erro) && (
          <div style={{ background: resolver.erro ? '#FFEBEE' : resolver.concluido ? '#F3E5F5' : '#EDE7F6', border: `1px solid ${resolver.erro ? '#FFCDD2' : '#CE93D8'}`, borderRadius: '12px', padding: '14px 20px', marginBottom: '16px' }}>
            {resolver.erro ? <p style={{ margin: 0, color: '#C62828', fontSize: '14px' }}>❌ Erro: {resolver.erro}</p>
            : resolver.concluido ? <p style={{ margin: 0, color: '#6A1B9A', fontSize: '14px' }}>✅ {resolver.resolvidos} transportadoras preenchidas{resolver.ainda_pendentes > 0 ? ` — ${resolver.ainda_pendentes} sem nome` : '!'}</p>
            : <p style={{ margin: 0, color: '#6A1B9A', fontSize: '14px' }}>🔍 Buscando transportadoras... {resolver.resolvidos} resolvidas</p>}
          </div>
        )}

        {(xmlImport.running || xmlImport.mensagem || xmlImport.erro) && (
          <div style={{ background: xmlImport.erro ? '#FFEBEE' : '#E3F2FD', border: `1px solid ${xmlImport.erro ? '#FFCDD2' : '#BBDEFB'}`, borderRadius: '12px', padding: '14px 20px', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: xmlImport.erro ? '#C62828' : '#1565C0', fontSize: '14px' }}>
              {xmlImport.erro ? `❌ Erro: ${xmlImport.erro}` : xmlImport.running ? '⟳ Processando XMLs...' : `✅ ${xmlImport.mensagem}`}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Total de CTes', valor: resumo?.total ?? '—', icon: '📦', cor: '#1A1916' },
            { label: 'Valor Total', valor: resumo ? fmt(resumo.valor_total) : '—', icon: '💰', cor: '#2E7D32' },
            { label: 'Faturadas', valor: resumo?.faturado ?? '—', icon: '🟢', cor: '#2E7D32' },
            { label: 'A vencer', valor: resumo?.pendente ?? '—', icon: '🟡', cor: '#E65100' },
            { label: 'Canceladas', valor: resumo?.cancelado ?? '—', icon: '🔴', cor: '#C62828' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '10px 16px', border: '1px solid #E8E6E0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{card.icon}</span>
                <span style={{ fontSize: '19px', fontWeight: '700', color: card.cor, letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
                  {carregando && !resumo ? <span style={{ color: '#ccc' }}>—</span> : card.valor}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="🔍 Buscar por número, transportadora ou destinatário..."
            value={busca} onChange={e => setBusca(e.target.value)}
            style={{ flex: '1', minWidth: '240px', padding: '9px 14px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', background: '#fff', outline: 'none' }} />
          {['Todos', 'Faturado', 'A vencer', 'Cancelado'].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: filtroStatus === s ? '#1A1916' : '#D8D6D0', background: filtroStatus === s ? '#1A1916' : '#fff', color: filtroStatus === s ? '#fff' : '#555', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>{s}</button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#888780', whiteSpace: 'nowrap' }}>Data de Emissão:</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '12px', background: '#fff', outline: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', color: '#888780' }}>até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '12px', background: '#fff', outline: 'none', cursor: 'pointer' }} />
            {(dataInicio || dataFim) && (
              <button onClick={() => { setDataInicio(''); setDataFim('') }}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', background: '#fff', color: '#888', fontSize: '12px', cursor: 'pointer' }}>✕ Limpar</button>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {carregando ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888780', fontSize: '14px' }}>Carregando CTes...</div>
          ) : ctes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888780', fontSize: '14px' }}>
              {totalCtes === 0 ? 'Nenhuma CT-e. Clique em "Sincronizar CTes" para importar.' : 'Nenhuma CT-e corresponde aos filtros.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 360px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    {['Nº CT-e', 'Transportadora', 'Destinatário', 'Origem → Destino', 'Modal', 'Peso (kg)', 'Centro de Custo', 'Valor', 'Emissão', 'Status'].map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: '600', color: '#555', fontSize: '12px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1, background: '#F8F7F4' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ctes.map((c, i) => {
                    const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.Pendente
                    const transportadora = c.fornecedor_nome || c.remetente_nome || '—'
                    const origem = c.uf_origem || '?'
                    const destino = c.uf_destino || '?'
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={{ padding: '6px 12px', fontWeight: '600' }}>{c.numero_cte ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#444', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transportadora}</td>
                        <td style={{ padding: '6px 12px', color: '#444', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.destinatario_nome || '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#666', whiteSpace: 'nowrap' }}>{origem} → {destino}</td>
                        <td style={{ padding: '6px 12px', color: '#666' }}>{c.modal ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#666', whiteSpace: 'nowrap' }}>{c.peso_real ? c.peso_real.toLocaleString('pt-BR') : '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#666', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>{c.centro_custo_nome || '—'}</td>
                        <td style={{ padding: '6px 12px', fontWeight: '600', color: '#2E7D32', whiteSpace: 'nowrap' }}>{c.valor_servico != null ? fmt(c.valor_servico) : '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#666', whiteSpace: 'nowrap' }}>{c.data_emissao ? new Date(c.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>{c.status === 'Pendente' ? 'A vencer' : c.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#888780' }}>Página {page} de {totalPages} · {totalCtes.toLocaleString('pt-BR')} registros</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)} disabled={page === 1} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #D8D6D0', background: page === 1 ? '#f5f5f5' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>⏮ Primeira</button>
                <button onClick={() => carregarCtes(page - 1, filtroStatus, busca, dataInicio, dataFim)} disabled={page === 1} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #D8D6D0', background: page === 1 ? '#f5f5f5' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>← Anterior</button>
                <button onClick={() => carregarCtes(page + 1, filtroStatus, busca, dataInicio, dataFim)} disabled={page === totalPages} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #D8D6D0', background: page === totalPages ? '#f5f5f5' : '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Próxima →</button>
                <button onClick={() => carregarCtes(totalPages, filtroStatus, busca, dataInicio, dataFim)} disabled={page === totalPages} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #D8D6D0', background: page === totalPages ? '#f5f5f5' : '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Última ⏭</button>
              </div>
            </div>
          )}
        </div>
        </>)}
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus { border-color: #1A1916 !important; box-shadow: 0 0 0 2px rgba(26,25,22,0.1); }
      `}</style>
    </div>
  )
}
