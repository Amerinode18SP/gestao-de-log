'use client'

// ============================================================
// Painel (dashboard) de Serviços — Frete / Coleta / Motoboy
// Gráficos interativos (recharts) com filtros por fornecedor, ano,
// mês, período e tipo, e granularidade da série (ano/mês/semana).
// Busca todos os serviços da empresa e agrega no cliente.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, BarChart, LabelList,
} from 'recharts'
import * as XLSX from 'xlsx'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'

type Tipo = 'Frete' | 'Coleta' | 'Motoboy'

interface ServicoDash {
  id: string
  tipo: Tipo
  fornecedor?: string
  data_servico?: string
  hora_saida?: string
  periodo?: string
  fds_feriado?: boolean
  valor_total?: number
  quantidade?: number
  os_controle?: string
  chamados?: string
  cliente?: string
  veiculo?: string
  km_faturado?: number
  origem_cidade?: string
  destino_cidade?: string
  destino_descricao?: string
}

const TIPO_COLOR: Record<string, string> = { Frete: '#185FA5', Coleta: '#3A6B12', Motoboy: '#C77D0A' }
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const brl = (v?: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
function brlCompacto(v: number) {
  if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
  return brl(v)
}

// quantidade de chamados de um registro (campo quantidade; ao menos 1)
const qtdeChamados = (s: ServicoDash) => (s.quantidade != null && s.quantidade > 0 ? s.quantidade : 1)

// Semana do mês (1 a 4) pela data ISO. Dias 1–7 = 1, 8–14 = 2,
// 15–21 = 3, e do 22 em diante = 4. Assim os dias finais do mês
// (29–31) caem na semana 4 (a última semana do próprio mês), e cada
// semana fica sempre dentro de um único mês.
function semanaDoMes(iso: string): number {
  const dia = parseInt(iso.slice(8, 10), 10)
  return Math.min(4, Math.max(1, Math.ceil(dia / 7)))
}

type Granularidade = 'ano' | 'mes' | 'semana'

export default function ServicosDashboard() {
  const [dados, setDados] = useState<ServicoDash[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [fFornecedor, setFFornecedor] = useState('Todos')
  const [fAno, setFAno] = useState('Todos')
  const [fMes, setFMes] = useState('Todos')
  const [fPeriodo, setFPeriodo] = useState('Todos')
  const [fTipo, setFTipo] = useState('Todos')
  const [gran, setGran] = useState<Granularidade>('mes')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/servicos?all=1&empresa_id=' + EMPRESA_ID)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar')
        if (vivo) setDados((json.servicos as ServicoDash[]) ?? [])
      } catch (e: any) {
        if (vivo) setErro(e?.message || String(e))
      } finally {
        if (vivo) setLoading(false)
      }
    })()
    return () => { vivo = false }
  }, [])

  // opções dos filtros (derivadas dos dados)
  const fornecedores = useMemo(
    () => Array.from(new Set(dados.map(d => d.fornecedor).filter(Boolean))).sort() as string[],
    [dados],
  )
  const anos = useMemo(
    () => Array.from(new Set(dados.map(d => d.data_servico?.slice(0, 4)).filter(Boolean))).sort().reverse() as string[],
    [dados],
  )

  // aplica filtros
  const filtrados = useMemo(() => dados.filter(d => {
    if (fFornecedor !== 'Todos' && (d.fornecedor || '') !== fFornecedor) return false
    if (fTipo !== 'Todos' && d.tipo !== fTipo) return false
    if (fPeriodo !== 'Todos' && (d.periodo || '') !== fPeriodo) return false
    if (fAno !== 'Todos' && d.data_servico?.slice(0, 4) !== fAno) return false
    if (fMes !== 'Todos' && d.data_servico?.slice(5, 7) !== fMes) return false
    return true
  }), [dados, fFornecedor, fTipo, fPeriodo, fAno, fMes])

  // KPIs
  const kpi = useMemo(() => {
    const valor = filtrados.reduce((a, s) => a + (s.valor_total ?? 0), 0)
    const chamados = filtrados.reduce((a, s) => a + qtdeChamados(s), 0)
    const servicos = filtrados.length
    return { valor, chamados, servicos, ticket: chamados ? valor / chamados : 0 }
  }, [filtrados])

  // série temporal por granularidade
  const serie = useMemo(() => {
    const mapa = new Map<string, { ordem: string; label: string; valor: number; chamados: number }>()
    for (const s of filtrados) {
      if (!s.data_servico) continue
      let ordem: string, label: string
      if (gran === 'ano') {
        ordem = s.data_servico.slice(0, 4); label = ordem
      } else if (gran === 'mes') {
        ordem = s.data_servico.slice(0, 7)
        const mi = parseInt(s.data_servico.slice(5, 7), 10) - 1
        label = `${MESES[mi] ?? '?'}/${s.data_servico.slice(2, 4)}`
      } else {
        const mi = parseInt(s.data_servico.slice(5, 7), 10) - 1
        const sem = semanaDoMes(s.data_servico)
        ordem = `${s.data_servico.slice(0, 7)}-S${sem}`
        label = `S${sem} ${MESES[mi] ?? '?'}/${s.data_servico.slice(2, 4)}`
      }
      const cur = mapa.get(ordem) ?? { ordem, label, valor: 0, chamados: 0 }
      cur.valor += s.valor_total ?? 0
      cur.chamados += qtdeChamados(s)
      mapa.set(ordem, cur)
    }
    return Array.from(mapa.values()).sort((a, b) => a.ordem.localeCompare(b.ordem))
  }, [filtrados, gran])

  // por fornecedor (top 10 por valor)
  const porFornecedor = useMemo(() => {
    const mapa = new Map<string, { label: string; valor: number; chamados: number }>()
    for (const s of filtrados) {
      const k = s.fornecedor || '(sem fornecedor)'
      const cur = mapa.get(k) ?? { label: k, valor: 0, chamados: 0 }
      cur.valor += s.valor_total ?? 0
      cur.chamados += qtdeChamados(s)
      mapa.set(k, cur)
    }
    return Array.from(mapa.values()).sort((a, b) => b.valor - a.valor).slice(0, 10)
  }, [filtrados])

  // por tipo
  const porTipo = useMemo(() => {
    const mapa = new Map<string, { label: string; valor: number; chamados: number }>()
    for (const s of filtrados) {
      const cur = mapa.get(s.tipo) ?? { label: s.tipo, valor: 0, chamados: 0 }
      cur.valor += s.valor_total ?? 0
      cur.chamados += qtdeChamados(s)
      mapa.set(s.tipo, cur)
    }
    return Array.from(mapa.values()).sort((a, b) => b.valor - a.valor)
  }, [filtrados])

  // por período (só Diurno/Noturno — ignora os sem período)
  const porPeriodo = useMemo(() => {
    const mapa = new Map<string, { label: string; valor: number; chamados: number }>()
    for (const s of filtrados) {
      const p = s.periodo
      if (!p) continue
      const cur = mapa.get(p) ?? { label: p, valor: 0, chamados: 0 }
      cur.valor += s.valor_total ?? 0
      cur.chamados += qtdeChamados(s)
      mapa.set(p, cur)
    }
    return Array.from(mapa.values()).sort((a, b) => b.valor - a.valor)
  }, [filtrados])

  // FDS/Feriado vs Dia útil (sem marca = "Dia útil")
  const porFds = useMemo(() => {
    const acc = { util: { label: 'Dia útil', valor: 0, chamados: 0 }, fds: { label: 'FDS/Feriado', valor: 0, chamados: 0 } }
    for (const s of filtrados) {
      const alvo = s.fds_feriado ? acc.fds : acc.util
      alvo.valor += s.valor_total ?? 0
      alvo.chamados += qtdeChamados(s)
    }
    return [acc.util, acc.fds]
  }, [filtrados])

  // resumo textual dos filtros (cabeçalho do PDF e do Excel)
  const resumoFiltros = [
    `Fornecedor: ${fFornecedor}`,
    `Ano: ${fAno}`,
    `Mês: ${fMes === 'Todos' ? 'Todos' : MESES_FULL[parseInt(fMes, 10) - 1]}`,
    `Período: ${fPeriodo}`,
    `Tipo: ${fTipo}`,
  ].join('  ·  ')

  function carimbo() {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new()

    const resumo = [
      ['Painel de Serviços'],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      ['Filtros', resumoFiltros],
      [],
      ['Indicador', 'Valor'],
      ['Valor total', kpi.valor],
      ['Chamados', kpi.chamados],
      ['Serviços (linhas)', kpi.servicos],
      ['Custo médio por chamado', kpi.ticket],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo')

    const aba = (nome: string, linhas: any[]) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), nome)

    aba('Evolucao', serie.map(s => ({ Período: s.label, Gastos: s.valor, Chamados: s.chamados })))
    aba('Por Fornecedor', porFornecedor.map(x => ({ Fornecedor: x.label, Gastos: x.valor, Chamados: x.chamados })))
    aba('Por Tipo', porTipo.map(x => ({ Tipo: x.label, Gastos: x.valor, Chamados: x.chamados })))
    aba('Por Periodo', porPeriodo.map(x => ({ Período: x.label, Gastos: x.valor, Chamados: x.chamados })))
    aba('Dia util x FDS', porFds.map(x => ({ Categoria: x.label, Gastos: x.valor, Chamados: x.chamados })))
    aba('Detalhado', filtrados.map(s => ({
      Tipo: s.tipo, Fornecedor: s.fornecedor ?? '', Data: s.data_servico ?? '', Horário: s.hora_saida ?? '',
      Período: s.periodo ?? '', 'FDS/Feriado': s.fds_feriado ? 'Sim' : 'Não', 'OS/Controle': s.os_controle ?? '',
      Chamado: s.chamados ?? '', Cliente: s.cliente ?? '', Veículo: s.veiculo ?? '',
      'Origem': s.origem_cidade ?? '', 'Destino': s.destino_cidade ?? s.destino_descricao ?? '',
      KM: s.km_faturado ?? '', Qtde: s.quantidade ?? '', Valor: s.valor_total ?? 0,
    })))

    XLSX.writeFile(wb, `painel-servicos-${carimbo()}.xlsx`)
  }

  if (loading) return <Aviso texto="Carregando painel…" />
  if (erro) return <Aviso texto={'Erro ao carregar: ' + erro} cor="#791F1F" />
  if (dados.length === 0) return <Aviso texto="Sem serviços para analisar. Importe uma planilha na aba Lista." />

  const sel: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid #D4D2CA', fontSize: 12, background: '#fff' }

  const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid #D4D2CA', fontSize: 12, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }

  return (
    <div className="painel-print-area">
      <style>{`
        .print-only { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          .painel-print-area, .painel-print-area * { visibility: visible; }
          .painel-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block; }
        }
      `}</style>

      {/* Cabeçalho que só aparece na impressão/PDF */}
      <div className="print-only" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1916' }}>Painel de Serviços — Amerinode</div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{resumoFiltros}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Gerado em {new Date().toLocaleString('pt-BR')}</div>
      </div>

      {/* FILTROS + AÇÕES */}
      <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} style={sel}>
          <option value="Todos">Todos os fornecedores</option>
          {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={fAno} onChange={e => setFAno(e.target.value)} style={sel}>
          <option value="Todos">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fMes} onChange={e => setFMes(e.target.value)} style={sel}>
          <option value="Todos">Todos os meses</option>
          {MESES_FULL.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        <select value={fPeriodo} onChange={e => setFPeriodo(e.target.value)} style={sel}>
          <option value="Todos">Todos os períodos</option>
          <option value="Diurno">Diurno</option>
          <option value="Noturno">Noturno</option>
        </select>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={sel}>
          <option value="Todos">Todos os tipos</option>
          <option value="Frete">Frete</option>
          <option value="Coleta">Coleta</option>
          <option value="Motoboy">Motoboy</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={exportarExcel} style={{ ...btn, borderColor: '#3A6B12', color: '#3A6B12' }}>⬇️ Excel (.xlsx)</button>
          <button onClick={() => window.print()} style={{ ...btn, borderColor: '#185FA5', color: '#185FA5' }}>🖨️ Imprimir / PDF</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Kpi titulo="Valor total" valor={brl(kpi.valor)} cor="#185FA5" />
        <Kpi titulo="Chamados" valor={kpi.chamados.toLocaleString('pt-BR')} cor="#C77D0A" />
        <Kpi titulo="Serviços (linhas)" valor={kpi.servicos.toLocaleString('pt-BR')} cor="#3A6B12" />
        <Kpi titulo="Custo médio / chamado" valor={brl(kpi.ticket)} cor="#6B3FA0" />
      </div>

      {/* SÉRIE TEMPORAL */}
      <Card titulo="Evolução de gastos e chamados"
        acao={
          <div style={{ display: 'flex', gap: 4 }}>
            {(['ano', 'mes', 'semana'] as Granularidade[]).map(g => (
              <button key={g} onClick={() => setGran(g)}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${gran === g ? '#185FA5' : '#D4D2CA'}`,
                  background: gran === g ? '#E6F1FB' : '#fff', color: gran === g ? '#185FA5' : '#888',
                  fontWeight: gran === g ? 600 : 400, textTransform: 'capitalize' }}>
                {g === 'mes' ? 'Mês' : g === 'ano' ? 'Ano' : 'Semana'}
              </button>
            ))}
          </div>
        }>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serie} margin={{ top: 22, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis yAxisId="esq" tick={{ fontSize: 11, fill: '#888' }} tickFormatter={brlCompacto} width={70} />
            <YAxis yAxisId="dir" orientation="right" tick={{ fontSize: 11, fill: '#888' }} width={40} />
            <Tooltip formatter={(v: any, n: any) => n === 'Gastos' ? brl(Number(v)) : Number(v).toLocaleString('pt-BR')}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E0D8' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="esq" dataKey="valor" name="Gastos" fill="#185FA5" radius={[4, 4, 0, 0]} maxBarSize={48}>
              <LabelList dataKey="valor" position="top" formatter={(v: any) => brlCompacto(Number(v))} fill="#185FA5" fontSize={10} />
            </Bar>
            <Line yAxisId="dir" dataKey="chamados" name="Chamados" stroke="#C77D0A" strokeWidth={2} dot={{ r: 3 }}>
              <LabelList dataKey="chamados" position="top" formatter={(v: any) => Number(v).toLocaleString('pt-BR')} fill="#C77D0A" fontSize={10} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* GRID 2 COLUNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card titulo="Gastos por fornecedor (top 10)">
          <ResponsiveContainer width="100%" height={Math.max(220, porFornecedor.length * 34)}>
            <BarChart data={porFornecedor} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} tickFormatter={brlCompacto} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#555' }} width={130} />
              <Tooltip formatter={(v: any, n: any) => n === 'Gastos' ? brl(Number(v)) : Number(v).toLocaleString('pt-BR')}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E0D8' }} />
              <Bar dataKey="valor" name="Gastos" fill="#185FA5" radius={[0, 4, 4, 0]} maxBarSize={26}>
                <LabelList dataKey="valor" position="right" formatter={(v: any) => brlCompacto(Number(v))} fill="#555" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card titulo="Gastos por tipo de serviço">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porTipo} dataKey="valor" nameKey="label" cx="50%" cy="50%" outerRadius={90}
                label={(e: any) => `${e.name}: ${brlCompacto(Number(e.value))}`} labelLine={false}>
                {porTipo.map(t => <Cell key={t.label} fill={TIPO_COLOR[t.label] || '#999'} />)}
              </Pie>
              <Tooltip formatter={(v: any) => brl(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E0D8' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card titulo="Gastos por período">
          {porPeriodo.length === 0 ? <Aviso texto="Sem período informado nos serviços filtrados." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porPeriodo} margin={{ top: 20, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#555' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} tickFormatter={brlCompacto} width={70} />
                <Tooltip formatter={(v: any, n: any) => n === 'Gastos' ? brl(Number(v)) : Number(v).toLocaleString('pt-BR')}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E0D8' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="valor" name="Gastos" radius={[4, 4, 0, 0]} maxBarSize={70}>
                  {porPeriodo.map(p => <Cell key={p.label} fill={p.label === 'Noturno' ? '#3B5BA5' : '#E8A317'} />)}
                  <LabelList dataKey="valor" position="top" formatter={(v: any) => brl(Number(v))} fill="#555" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card titulo="Gastos: dia útil vs FDS/feriado">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porFds} margin={{ top: 20, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE7" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} tickFormatter={brlCompacto} width={70} />
              <Tooltip formatter={(v: any, n: any) => n === 'Gastos' ? brl(Number(v)) : Number(v).toLocaleString('pt-BR')}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E0D8' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="valor" name="Gastos" radius={[4, 4, 0, 0]} maxBarSize={70}>
                {porFds.map(p => <Cell key={p.label} fill={p.label === 'FDS/Feriado' ? '#C62828' : '#3A6B12'} />)}
                <LabelList dataKey="valor" position="top" formatter={(v: any) => brl(Number(v))} fill="#555" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

// ---------- componentes auxiliares ----------
function Kpi({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E2E0D8', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor, letterSpacing: '-0.5px' }}>{valor}</div>
    </div>
  )
}

function Card({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E2E0D8', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1916' }}>{titulo}</div>
        {acao}
      </div>
      {children}
    </div>
  )
}

function Aviso({ texto, cor = '#999' }: { texto: string; cor?: string }) {
  return <div style={{ padding: 24, textAlign: 'center', color: cor, fontSize: 13 }}>{texto}</div>
}
