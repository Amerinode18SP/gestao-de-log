// ============================================================
// Detecção de duplicados de Serviços
// Regra (decidida com a usuária): dois registros são duplicados
// quando coincidem em PELO MENOS 3 dos 4 campos
//   fornecedor, data_servico, chamados (chamado), valor_total (valor)
// COM O CHAMADO OBRIGATORIAMENTE entre os campos iguais.
// Campo vazio NUNCA conta como "igual".
//
// Por quê o chamado é obrigatório: o chamado é a identidade do serviço.
// Sem ele, fornecedor+data+valor coincidem naturalmente entre serviços
// distintos (ex.: vários fretes de R$48,30 no mesmo dia) e geravam
// falsos duplicados. Então só valem as 3 combinações que incluem o
// chamado: (chamado+fornecedor+data), (chamado+fornecedor+valor),
// (chamado+data+valor). Geramos uma chave por combinação (só quando os
// 3 campos têm valor); se duas linhas compartilham qualquer chave, são
// duplicadas.
// ============================================================

export interface ChaveCampos {
  fornecedor?: string | null
  data_servico?: string | null
  chamados?: string | null
  valor_total?: number | string | null
  hora_saida?: string | null
  os_controle?: string | null
}

const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g')

function normTexto(v: any): string | null {
  if (v == null) return null
  const s = String(v).normalize('NFD').replace(ACENTOS, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

function normData(v: any): string | null {
  if (v == null || v === '') return null
  const s = String(v).slice(0, 10) // 'YYYY-MM-DD'
  return s === '' ? null : s
}

function normValor(v: any): string | null {
  if (v == null || v === '') return null
  const num = typeof v === 'number'
    ? v
    : parseFloat(String(v).replace(/r\$|\s/gi, '').replace(/\./g, '').replace(',', '.'))
  return isFinite(num) ? num.toFixed(2) : null
}

// As chaves das 3 combinações de 3 campos QUE INCLUEM o chamado. Só
// gera a chave quando os 3 campos daquela combinação têm valor (vazio
// não conta como igual) — logo, registro sem chamado nunca é duplicado.
// O horário (hora_saida) e o OS/Controle (os_controle) entram em TODA
// chave: o mesmo chamado em horário diferente, ou com OS/Controle
// diferente, é serviço diferente. Então só duplica se horário E
// OS/Controle também baterem (ou ambos estiverem vazios).
export function chavesDuplicidade(r: ChaveCampos): string[] {
  const f = normTexto(r.fornecedor)
  const d = normData(r.data_servico)
  const c = normTexto(r.chamados)
  const v = normValor(r.valor_total)
  const h = normTexto(r.hora_saida) || ''   // vazio casa com vazio
  const o = normTexto(r.os_controle) || ''  // vazio casa com vazio
  const out: string[] = []
  if (!c) return out // sem chamado não há como confirmar duplicidade
  if (f && d) out.push(`fdc|${f}|${d}|${c}|${h}|${o}`)
  if (f && v) out.push(`fcv|${f}|${c}|${v}|${h}|${o}`)
  if (d && v) out.push(`dcv|${d}|${c}|${v}|${h}|${o}`)
  return out
}

// Filtra a lista de novos registros, descartando os que duplicam um
// registro já existente (chaves em `existentes`) OU outro registro já
// aceito no mesmo lote.
export function filtrarDuplicados<T extends ChaveCampos>(
  novos: T[],
  existentes: Set<string>,
): { aceitos: T[]; duplicados: number } {
  const vistos = new Set(existentes)
  const aceitos: T[] = []
  let duplicados = 0
  for (const r of novos) {
    const keys = chavesDuplicidade(r)
    if (keys.length > 0 && keys.some(k => vistos.has(k))) {
      duplicados++
      continue
    }
    aceitos.push(r)
    for (const k of keys) vistos.add(k)
  }
  return { aceitos, duplicados }
}
