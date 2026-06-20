// ============================================================
// Importação de planilhas de Serviços (Frete / Coleta / Motoboy)
// Detecta automaticamente o formato:
//   - "Fechamento" (PLANILHA FECHAMENTO ... — aba Solicitações de Serviço)
//   - "Conferencia" (Conferência Semanal — aba Moto Urgente Dedicado)
// e normaliza ambos para o mesmo modelo (tabela `servicos`).
// ============================================================
import * as XLSX from 'xlsx'

export type FormatoPlanilha = 'Fechamento' | 'Conferencia' | 'Desconhecido'

export interface ServicoRow {
  os_controle?: string
  base?: string
  cliente?: string
  solicitante?: string
  aprovacao?: string
  colaborador?: string
  data_servico?: string
  hora_saida?: string
  periodo?: string
  fds_feriado?: boolean
  capital_interior?: string
  mes_referencia?: string
  semana_referencia?: string
  veiculo?: string
  origem_endereco?: string
  origem_bairro?: string
  origem_cidade?: string
  origem_uf?: string
  origem_cep?: string
  destino_endereco?: string
  destino_bairro?: string
  destino_cidade?: string
  destino_uf?: string
  destino_cep?: string
  destino_descricao?: string
  distancia_km?: number
  km_faturado?: number
  km_adicional?: number
  valor_km?: number
  valor_minimo?: number
  pedagios?: number
  tempo_espera?: string
  valor_espera?: number
  adicional_noturno?: number
  adicional_fds?: number
  outras_cobrancas?: number
  valor_total?: number
  quantidade?: number
  chamados?: string
  status?: string
  data_entrega?: string
  hora_entrega?: string
  recebedor?: string
  tempo_execucao?: string
  tempo_limite?: string
  sla?: string
  retorno?: boolean
  observacao?: string
}

export interface ParseResult {
  formato: FormatoPlanilha
  aba: string
  linhas: ServicoRow[]
  ignoradas: number
}

// ---------- helpers ----------
const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g') // combining marks
function norm(v: any): string {
  if (v == null) return ''
  return String(v).normalize('NFD').replace(ACENTOS, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

function toNumber(v: any): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number') return isFinite(v) ? v : undefined
  let s = String(v).trim().replace(/r\$|\s/gi, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : undefined
}

function toInt(v: any): number | undefined {
  const n = toNumber(v)
  return n == null ? undefined : Math.round(n)
}

function toDateISO(v: any): string | undefined {
  if (v == null || v === '') return undefined
  if (v instanceof Date) {
    const y = v.getFullYear()
    const mo = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return undefined
}

function toTime(v: any): string | undefined {
  if (v == null || v === '') return undefined
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`
  }
  const m = String(v).trim().match(/(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  const s = String(v).trim()
  return s || undefined
}

function toBool(v: any): boolean {
  if (v == null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v > 0
  const s = norm(v)
  return s === 'sim' || s === 's' || s === 'true' || s === '1' || s === 'x'
}

function str(v: any): string | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  return s === '' ? undefined : s
}

// Período pela hora de abertura: Diurno 06:00–17:59, senão Noturno (18:00–05:59)
function periodoPorHora(hora?: string): string | undefined {
  if (!hora) return undefined
  const m = hora.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  const min = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  return min >= 360 && min <= 1079 ? 'Diurno' : 'Noturno'
}

// Localiza a coluna cujo cabeçalho casa EXATAMENTE (sem acento/caixa) com um dos nomes
function idx(hdr: string[], nomes: string[]): number {
  for (const n of nomes) {
    const i = hdr.indexOf(n)
    if (i !== -1) return i
  }
  return -1
}
function idxAll(hdr: string[], nome: string): number[] {
  const out: number[] = []
  hdr.forEach((h, i) => { if (h === nome) out.push(i) })
  return out
}

// Detecta o formato e a linha do cabeçalho varrendo as primeiras linhas
function detectar(rows: any[][]): { formato: FormatoPlanilha; headerRow: number } | null {
  const max = Math.min(rows.length, 8)
  for (let r = 0; r < max; r++) {
    const hs = (rows[r] || []).map(norm)
    const set = new Set(hs.filter(Boolean))
    if (set.has('controle') && (hs.some(h => h.startsWith('deslocamento')) || set.has('km faturado') || set.has('sla')))
      return { formato: 'Conferencia', headerRow: r }
    if (set.has('os') && (set.has('base sts') || set.has('km itaim') || set.has('qtade')))
      return { formato: 'Fechamento', headerRow: r }
  }
  return null
}

// Monta o cabeçalho normalizado. Para a Conferência, o título pode estar
// quebrado em 2 linhas (ex.: célula numérica em cima, nome embaixo).
function montarHeader(rows: any[][], hr: number, formato: FormatoPlanilha): string[] {
  const row1 = rows[hr] || []
  const row2 = rows[hr + 1] || []
  const width = Math.max(row1.length, row2.length)
  const hdr: string[] = []
  for (let c = 0; c < width; c++) {
    let h = typeof row1[c] === 'string' ? norm(row1[c]) : ''
    if (!h && formato === 'Conferencia') h = typeof row2[c] === 'string' ? norm(row2[c]) : ''
    hdr[c] = h
  }
  return hdr
}

function mesRef(dataIso?: string): string | undefined {
  return dataIso ? dataIso.slice(0, 7) : undefined
}

// ---------- parser principal ----------
export function parsePlanilhaServicos(buf: ArrayBuffer): ParseResult {
  // SheetJS lê de forma mais confiável a partir de Uint8Array do que de ArrayBuffer cru
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })

  // Escolhe a melhor aba: a primeira cujo cabeçalho é reconhecido
  let escolha: { aba: string; rows: any[][]; det: { formato: FormatoPlanilha; headerRow: number } } | null = null
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome]
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null, blankrows: false })
    const det = detectar(rows)
    if (det) { escolha = { aba: nome, rows, det }; break }
  }

  if (!escolha) {
    return { formato: 'Desconhecido', aba: wb.SheetNames[0] ?? '', linhas: [], ignoradas: 0 }
  }

  const { aba, rows, det } = escolha
  const hdr = montarHeader(rows, det.headerRow, det.formato)
  const dataStart = det.formato === 'Conferencia' ? det.headerRow + 2 : det.headerRow + 1

  const linhas: ServicoRow[] = []
  let ignoradas = 0

  if (det.formato === 'Fechamento') {
    const c = {
      data: idx(hdr, ['emissao']),
      os: idx(hdr, ['os']),
      hora: idx(hdr, ['abertura']),
      periodo: idx(hdr, ['periodo']),
      fds: idx(hdr, ['fds/feriado', 'fds feriado', 'feriado']),
      valorKm: idx(hdr, ['valor km']),
      base: idx(hdr, ['origem']),
      destDesc: idx(hdr, ['base sts']),
      destEnd: idx(hdr, ['endereco destino']),
      veiculo: idx(hdr, ['veiculo']),
      cliente: idx(hdr, ['cliente']),
      capInt: idx(hdr, ['capital interior']),
      solicitante: idx(hdr, ['solicitante']),
      kmRev: idx(hdr, ['km revisado']),
      kmItaim: idx(hdr, ['km itaim']),
      qtade: idx(hdr, ['qtade', 'quantidade']),
      total: idx(hdr, ['total']),
      obs: idx(hdr, ['destino']),
    }
    const chamadoCols = idxAll(hdr, 'chamado')

    for (let r = dataStart; r < rows.length; r++) {
      const row = rows[r] || []
      const os = c.os >= 0 ? str(row[c.os]) : undefined
      if (!os) { ignoradas++; continue }
      const data = c.data >= 0 ? toDateISO(row[c.data]) : undefined
      const hora = c.hora >= 0 ? toTime(row[c.hora]) : undefined
      const chamados = chamadoCols.map(i => str(row[i])).filter(Boolean).join(', ') || undefined
      linhas.push({
        os_controle: os,
        data_servico: data,
        mes_referencia: mesRef(data),
        hora_saida: hora,
        periodo: periodoPorHora(hora) ?? (c.periodo >= 0 ? str(row[c.periodo]) : undefined),
        fds_feriado: c.fds >= 0 ? toBool(row[c.fds]) : false,
        valor_km: c.valorKm >= 0 ? toNumber(row[c.valorKm]) : undefined,
        base: c.base >= 0 ? str(row[c.base]) : undefined,
        destino_descricao: c.destDesc >= 0 ? str(row[c.destDesc]) : undefined,
        destino_endereco: c.destEnd >= 0 ? str(row[c.destEnd]) : undefined,
        veiculo: c.veiculo >= 0 ? str(row[c.veiculo]) : undefined,
        cliente: c.cliente >= 0 ? str(row[c.cliente]) : undefined,
        capital_interior: c.capInt >= 0 ? str(row[c.capInt]) : undefined,
        solicitante: c.solicitante >= 0 ? str(row[c.solicitante]) : undefined,
        distancia_km: c.kmRev >= 0 ? toNumber(row[c.kmRev]) : undefined,
        km_faturado: c.kmItaim >= 0 ? toNumber(row[c.kmItaim]) : undefined,
        quantidade: c.qtade >= 0 ? toInt(row[c.qtade]) : undefined,
        valor_total: c.total >= 0 ? toNumber(row[c.total]) : undefined,
        chamados,
        observacao: c.obs >= 0 ? str(row[c.obs]) : undefined,
      })
    }
  } else {
    // Conferencia
    const c = {
      controle: idx(hdr, ['controle']),
      base: idx(hdr, ['base']),
      dataSaida: idx(hdr, ['data saida']),
      horaSaida: idx(hdr, ['hora saida']),
      periodo: idx(hdr, ['periodo']),
      semana: idx(hdr, ['semana']),
      aprovacao: idx(hdr, ['aprovacao']),
      solicitante: idx(hdr, ['solicitante']),
      oEnd: idx(hdr, ['endereco origem']),
      oCep: idx(hdr, ['cep origem']),
      oBai: idx(hdr, ['bairro origem']),
      oCid: idx(hdr, ['cidade origem']),
      oUf: idx(hdr, ['uf origem']),
      dEnd: idx(hdr, ['endereco destino']),
      dCep: idx(hdr, ['cep destino']),
      dBai: idx(hdr, ['bairro destino']),
      dCid: idx(hdr, ['cidade destino']),
      dUf: idx(hdr, ['uf destino']),
      distancia: idx(hdr, ['distancia']),
      kmFat: idx(hdr, ['km faturado']),
      kmAd: idx(hdr, ['km adicional']),
      valorKm: idx(hdr, ['valor do km']),
      valorMin: idx(hdr, ['valor minimo']),
      pedagios: idx(hdr, ['pedagios']),
      tempoEspera: idx(hdr, ['tempo de espera']),
      valorEspera: idx(hdr, ['valor espera']),
      adNot: idx(hdr, ['adicional noturno']),
      adFds: idx(hdr, ['adicional final de semana']),
      outras: idx(hdr, ['outras cobrancas']),
      faturamento: idx(hdr, ['faturamento']),
      total: idx(hdr, ['total']),
      quantidade: idx(hdr, ['quantidade']),
      colaborador: idx(hdr, ['colaborador']),
      status: idx(hdr, ['status']),
      recebedor: idx(hdr, ['nome e doc recebedor', 'recebedor']),
      dataEnt: idx(hdr, ['data entrega']),
      horaEnt: idx(hdr, ['hora entrega']),
      veiculo: idx(hdr, ['veiculo']),
      tExec: idx(hdr, ['tempo execucao']),
      tLim: idx(hdr, ['tempo limite']),
      sla: idx(hdr, ['sla']),
      retorno: idx(hdr, ['retorno']),
      obs: idx(hdr, ['obs']),
    }

    for (let r = dataStart; r < rows.length; r++) {
      const row = rows[r] || []
      const ctrl = c.controle >= 0 ? str(row[c.controle]) : undefined
      if (!ctrl) { ignoradas++; continue }
      const data = c.dataSaida >= 0 ? toDateISO(row[c.dataSaida]) : undefined
      const hSaida = c.horaSaida >= 0 ? toTime(row[c.horaSaida]) : undefined
      const adFds = c.adFds >= 0 ? toNumber(row[c.adFds]) : undefined
      const faturamento = c.faturamento >= 0 ? toNumber(row[c.faturamento]) : undefined
      const total = c.total >= 0 ? toNumber(row[c.total]) : undefined
      linhas.push({
        os_controle: ctrl,
        base: c.base >= 0 ? str(row[c.base]) : undefined,
        data_servico: data,
        mes_referencia: mesRef(data),
        hora_saida: hSaida,
        periodo: periodoPorHora(hSaida) ?? (c.periodo >= 0 ? str(row[c.periodo]) : undefined),
        semana_referencia: c.semana >= 0 ? str(row[c.semana]) : undefined,
        aprovacao: c.aprovacao >= 0 ? str(row[c.aprovacao]) : undefined,
        solicitante: c.solicitante >= 0 ? str(row[c.solicitante]) : undefined,
        origem_endereco: c.oEnd >= 0 ? str(row[c.oEnd]) : undefined,
        origem_cep: c.oCep >= 0 ? str(row[c.oCep]) : undefined,
        origem_bairro: c.oBai >= 0 ? str(row[c.oBai]) : undefined,
        origem_cidade: c.oCid >= 0 ? str(row[c.oCid]) : undefined,
        origem_uf: c.oUf >= 0 ? str(row[c.oUf]) : undefined,
        destino_endereco: c.dEnd >= 0 ? str(row[c.dEnd]) : undefined,
        destino_cep: c.dCep >= 0 ? str(row[c.dCep]) : undefined,
        destino_bairro: c.dBai >= 0 ? str(row[c.dBai]) : undefined,
        destino_cidade: c.dCid >= 0 ? str(row[c.dCid]) : undefined,
        destino_uf: c.dUf >= 0 ? str(row[c.dUf]) : undefined,
        distancia_km: c.distancia >= 0 ? toNumber(row[c.distancia]) : undefined,
        km_faturado: c.kmFat >= 0 ? toNumber(row[c.kmFat]) : undefined,
        km_adicional: c.kmAd >= 0 ? toNumber(row[c.kmAd]) : undefined,
        valor_km: c.valorKm >= 0 ? toNumber(row[c.valorKm]) : undefined,
        valor_minimo: c.valorMin >= 0 ? toNumber(row[c.valorMin]) : undefined,
        pedagios: c.pedagios >= 0 ? toNumber(row[c.pedagios]) : undefined,
        tempo_espera: c.tempoEspera >= 0 ? toTime(row[c.tempoEspera]) : undefined,
        valor_espera: c.valorEspera >= 0 ? toNumber(row[c.valorEspera]) : undefined,
        adicional_noturno: c.adNot >= 0 ? toNumber(row[c.adNot]) : undefined,
        adicional_fds: adFds,
        fds_feriado: (adFds ?? 0) > 0,
        outras_cobrancas: c.outras >= 0 ? toNumber(row[c.outras]) : undefined,
        valor_total: faturamento ?? total,
        quantidade: c.quantidade >= 0 ? toInt(row[c.quantidade]) : undefined,
        colaborador: c.colaborador >= 0 ? str(row[c.colaborador]) : undefined,
        status: c.status >= 0 ? str(row[c.status]) : undefined,
        recebedor: c.recebedor >= 0 ? str(row[c.recebedor]) : undefined,
        data_entrega: c.dataEnt >= 0 ? toDateISO(row[c.dataEnt]) : undefined,
        hora_entrega: c.horaEnt >= 0 ? toTime(row[c.horaEnt]) : undefined,
        veiculo: c.veiculo >= 0 ? str(row[c.veiculo]) : undefined,
        tempo_execucao: c.tExec >= 0 ? toTime(row[c.tExec]) : undefined,
        tempo_limite: c.tLim >= 0 ? toTime(row[c.tLim]) : undefined,
        sla: c.sla >= 0 ? str(row[c.sla]) : undefined,
        retorno: c.retorno >= 0 ? toBool(row[c.retorno]) : false,
        chamados: c.obs >= 0 ? str(row[c.obs]) : undefined,
      })
    }
  }

  // Descarta linhas vazias: sem data, sem valor e sem destino — geralmente
  // linhas em branco/modelo da planilha que não devem virar registros.
  const validas = linhas.filter(l => !linhaVazia(l))
  ignoradas += linhas.length - validas.length

  return { formato: det.formato, aba, linhas: validas, ignoradas }
}

function linhaVazia(r: ServicoRow): boolean {
  return !r.data_servico
    && (r.valor_total == null || r.valor_total === 0)
    && !r.destino_endereco
    && !r.destino_descricao
    && !r.destino_cidade
}
