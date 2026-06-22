// ============================================================
// Helper de paginação para contornar o cap de 1000 linhas do Supabase
// (max-rows). Use em somatórios/relatórios/exports que precisam de TODAS
// as linhas — sem isso, valores ficam subcontados e exports truncados.
//
// `build` deve retornar um query builder já com .select() e filtros;
// aqui acrescentamos .order('id') (paginação estável) e .range().
// ============================================================
export async function buscarTudo<T = any>(build: () => any): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; from < 200000; from += PAGE) { // teto de segurança
    const { data, error } = await build().order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}
