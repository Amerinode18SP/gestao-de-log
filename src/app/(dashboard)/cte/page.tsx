'use client'

import { useEffect, useState, useCallback } from 'react'

interface Cte {
  id: string
  numero_cte: string
  chave_acesso: string
  tomador_nome: string
  remetente_nome: string
  destinatario_nome: string
  uf_origem: string
  uf_destino: string
  modal: string
  valor_servico: number
  status: string
  data_emissao: string
  fornecedor?: { nome: string; cnpj: string }
  centro_custo?: { nome: string }
}

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  Faturado:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Pendente:  { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500'   },
  Cancelado: { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500'     },
  Recebido:  { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500'    },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
}

function formatDate(date: string) {
  if (!date) return '-'
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default function CtePage() {
  const [ctes, setCtes] = useState<Cte[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [resumo, setResumo] = useState({ faturado: 0, pendente: 0, cancelado: 0, total: 0 })

  const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'

  const buscarCtes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        empresa_id: empresaId,
        page: String(page),
        page_size: '20',
      })
      if (filtroStatus) params.set('status', filtroStatus)
      if (busca && busca.trim()) params.set('busca', busca.trim())

      const res = await fetch(`/api/cte?${params}`)
      const data = await res.json()

      setCtes(data.data ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, filtroStatus, empresaId, busca])

  const buscarResumo = useCallback(async () => {
    try {
      const res = await fetch(`/api/cte?empresa_id=${empresaId}&page_size=1`)
      const data = await res.json()
      // Buscar totais por status
      const [f, p, c] = await Promise.all([
        fetch(`/api/cte?empresa_id=${empresaId}&status=Faturado&page_size=1`).then(r => r.json()),
        fetch(`/api/cte?empresa_id=${empresaId}&status=Pendente&page_size=1`).then(r => r.json()),
        fetch(`/api/cte?empresa_id=${empresaId}&status=Cancelado&page_size=1`).then(r => r.json()),
      ])
      setResumo({
        total: data.total ?? 0,
        faturado: f.total ?? 0,
        pendente: p.total ?? 0,
        cancelado: c.total ?? 0,
      })
    } catch (e) { console.error(e) }
  }, [empresaId])

  useEffect(() => { buscarCtes() }, [buscarCtes])
  useEffect(() => { buscarResumo() }, [buscarResumo])

  const ctesFiltrados = busca
    ? ctes.filter(c =>
        c.numero_cte?.includes(busca) ||
        c.tomador_nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.remetente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.fornecedor?.nome?.toLowerCase().includes(busca.toLowerCase())
      )
    : ctes

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">CT-e</h1>
            <p className="text-sm text-gray-500 mt-0.5">Conhecimentos de Transporte Eletrônico</p>
          </div>
          <div className="text-sm text-gray-500">
            {total.toLocaleString('pt-BR')} registros
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total CT-e', value: resumo.total, color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Faturados',  value: resumo.faturado,  color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Pendentes',  value: resumo.pendente,  color: 'text-amber-700',   bg: 'bg-amber-50'   },
            { label: 'Cancelados', value: resumo.cancelado, color: 'text-red-700',      bg: 'bg-red-50'     },
          ].map(card => (
            <div key={card.label} className={`${card.bg} rounded-xl border border-gray-200 p-4`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>
                {card.value.toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Buscar por número, transportadora..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filtroStatus}
            onChange={e => { setFiltroStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="Faturado">Faturado</option>
            <option value="Pendente">Pendente</option>
            <option value="Cancelado">Cancelado</option>
            <option value="Recebido">Recebido</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Carregando CT-e...</p>
              </div>
            </div>
          ) : ctesFiltrados.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-3">📦</p>
                <p className="text-sm font-medium">Nenhum CT-e encontrado</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nº CT-e</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Transportadora</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rota</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Emissão</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ctesFiltrados.map(cte => {
                    const s = STATUS_COLOR[cte.status] ?? STATUS_COLOR['Pendente']
                    return (
                      <tr key={cte.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-700">
                          {cte.numero_cte || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-800">
                            {cte.fornecedor?.nome || cte.tomador_nome || cte.remetente_nome || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {cte.uf_origem && cte.uf_destino
                            ? `${cte.uf_origem} → ${cte.uf_destino}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {formatDate(cte.data_emissao)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {formatCurrency(cte.valor_servico)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {cte.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {!loading && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
