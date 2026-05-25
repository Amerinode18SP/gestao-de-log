'use client'

import { useEffect, useState, useCallback } from 'react'

interface StateData { name: string; uf: string; ctes: number; value: number; modal: string }
interface ChartItem { label: string; value: number }
interface Summary { totalValue: number; totalCtes: number; stateCount: number; ticketMedio: number; topState: StateData | null }
interface MapData { summary: Summary; byState: StateData[]; byModal: ChartItem[]; byCC: ChartItem[]; transportadoras: string[]; centrosCusto: string[] }

const BLUE_STOPS = ['#dbeafe','#93c5fd','#3b82f6','#1d4ed8','#1e3a8a']
const MODAL_COLORS: Record<string,string> = { Rodoviário:'#1a56a0', Aéreo:'#2d8a60', Marítimo:'#b5742a' }
const CC_COLORS: Record<string,string> = { 'Logística SP':'#1a56a0','Logística RJ':'#2d8a60','Filial MG':'#b5742a','E-commerce':'#884cb5' }

const BRAZIL_PATHS: Record<string,{path:string;cx:number;cy:number}> = {
  AC:{path:'M 52 228 L 60 220 L 74 218 L 86 224 L 94 230 L 96 240 L 88 248 L 76 250 L 62 248 L 52 238 Z',cx:74,cy:234},
  AM:{path:'M 96 120 L 114 108 L 148 104 L 176 112 L 196 108 L 214 116 L 222 132 L 218 152 L 208 168 L 196 180 L 186 196 L 170 206 L 154 210 L 136 214 L 120 208 L 104 202 L 92 188 L 88 172 L 88 156 L 92 140 Z',cx:155,cy:158},
  RR:{path:'M 148 64 L 162 52 L 176 48 L 192 52 L 200 68 L 196 88 L 182 96 L 168 100 L 154 96 L 146 84 Z',cx:174,cy:74},
  PA:{path:'M 196 108 L 214 96 L 234 88 L 260 86 L 284 92 L 300 104 L 306 120 L 298 138 L 286 152 L 270 162 L 252 168 L 236 170 L 218 166 L 208 154 L 208 138 L 214 124 L 208 116 Z',cx:255,cy:128},
  AP:{path:'M 282 64 L 298 56 L 312 62 L 316 78 L 308 90 L 294 92 L 282 84 Z',cx:299,cy:75},
  RO:{path:'M 120 208 L 136 214 L 154 218 L 162 228 L 156 242 L 144 250 L 128 252 L 114 246 L 106 234 L 108 222 Z',cx:134,cy:230},
  TO:{path:'M 270 162 L 286 160 L 298 170 L 302 186 L 296 202 L 284 212 L 270 216 L 256 212 L 248 200 L 250 184 L 260 172 Z',cx:275,cy:189},
  MA:{path:'M 298 104 L 316 98 L 332 96 L 348 102 L 354 116 L 348 132 L 334 140 L 318 140 L 302 132 L 296 118 Z',cx:325,cy:118},
  PI:{path:'M 348 102 L 362 100 L 376 108 L 380 124 L 372 138 L 358 142 L 344 136 L 340 122 L 346 110 Z',cx:360,cy:120},
  CE:{path:'M 376 100 L 392 98 L 404 108 L 402 124 L 390 132 L 376 128 L 372 116 Z',cx:388,cy:114},
  RN:{path:'M 404 96 L 416 98 L 420 110 L 412 116 L 402 112 Z',cx:411,cy:106},
  PB:{path:'M 396 116 L 410 118 L 416 128 L 408 134 L 396 130 Z',cx:406,cy:124},
  PE:{path:'M 370 128 L 396 128 L 410 136 L 406 148 L 390 152 L 372 148 L 362 140 Z',cx:386,cy:139},
  AL:{path:'M 396 148 L 408 150 L 410 160 L 400 164 L 390 158 Z',cx:400,cy:156},
  SE:{path:'M 386 158 L 398 162 L 398 172 L 388 174 L 382 166 Z',cx:390,cy:166},
  BA:{path:'M 302 134 L 328 136 L 354 138 L 376 148 L 390 160 L 396 178 L 390 196 L 374 210 L 354 218 L 332 222 L 310 220 L 290 212 L 276 200 L 278 186 L 290 174 L 298 160 L 298 146 Z',cx:335,cy:180},
  MG:{path:'M 276 198 L 298 212 L 316 218 L 338 222 L 354 216 L 372 210 L 386 222 L 390 238 L 382 254 L 366 262 L 346 266 L 324 264 L 302 256 L 286 244 L 278 230 L 278 214 Z',cx:332,cy:234},
  ES:{path:'M 386 222 L 400 226 L 406 240 L 400 252 L 388 256 L 380 246 L 382 234 Z',cx:393,cy:238},
  RJ:{path:'M 366 262 L 384 258 L 398 264 L 402 276 L 392 284 L 376 282 L 364 274 Z',cx:383,cy:272},
  SP:{path:'M 278 230 L 300 252 L 320 264 L 346 266 L 360 278 L 356 296 L 340 304 L 318 302 L 296 292 L 276 278 L 264 264 L 266 248 L 272 238 Z',cx:313,cy:271},
  PR:{path:'M 264 264 L 284 278 L 302 290 L 320 302 L 334 308 L 332 322 L 316 330 L 296 330 L 274 320 L 256 306 L 250 290 L 256 276 Z',cx:291,cy:300},
  SC:{path:'M 256 308 L 280 322 L 298 330 L 310 338 L 304 350 L 288 354 L 268 346 L 252 334 L 248 320 Z',cx:280,cy:332},
  RS:{path:'M 248 320 L 270 348 L 286 356 L 296 368 L 284 382 L 264 384 L 244 374 L 228 358 L 226 342 L 234 328 Z',cx:262,cy:354},
  MS:{path:'M 210 248 L 236 246 L 256 254 L 264 268 L 258 286 L 244 294 L 224 292 L 206 280 L 202 266 Z',cx:233,cy:269},
  MT:{path:'M 154 218 L 178 214 L 202 212 L 224 218 L 240 234 L 240 254 L 228 266 L 210 268 L 190 260 L 170 246 L 156 234 Z',cx:197,cy:239},
  GO:{path:'M 248 198 L 268 196 L 284 206 L 290 222 L 284 238 L 268 244 L 250 242 L 236 230 L 234 216 L 242 206 Z',cx:263,cy:219},
  DF:{path:'M 272 218 L 280 216 L 284 222 L 278 226 L 272 224 Z',cx:278,cy:221},
}

function fmt(v: number) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR') }

function getStateColor(value: number, maxVal: number): string {
  if (!value || maxVal === 0) return '#e5e7eb'
  const i = Math.min(4, Math.floor(Math.pow(value / maxVal, 0.6) * 5))
  return BLUE_STOPS[i]
}

function BrazilMap({ byState }: { byState: StateData[] }) {
  const [tooltip, setTooltip] = useState<{text:string;x:number;y:number}|null>(null)
  const stateMap = Object.fromEntries(byState.map(d => [d.uf, d]))
  const maxVal = Math.max(...byState.map(d => d.value), 1)
  return (
    <div style={{position:'relative'}}>
      <svg viewBox="0 0 420 480" style={{width:'100%',display:'block'}}>
        {Object.entries(BRAZIL_PATHS).map(([uf, pd]) => {
          const d = stateMap[uf]
          const fill = d ? getStateColor(d.value, maxVal) : '#e5e7eb'
          const idx = d ? Math.min(4, Math.floor(Math.pow(d.value/maxVal,0.6)*5)) : -1
          return (
            <g key={uf} style={{cursor:d?'pointer':'default'}}
              onMouseEnter={e => d && setTooltip({text:`${d.name} (${uf})\n${fmt(d.value)} · ${d.ctes} CT-es\nModal: ${d.modal}`,x:(e as any).clientX,y:(e as any).clientY})}
              onMouseMove={e => d && tooltip && setTooltip(t=>t?{...t,x:(e as any).clientX,y:(e as any).clientY}:null)}
              onMouseLeave={()=>setTooltip(null)}>
              <path d={pd.path} fill={fill} stroke="#fff" strokeWidth={1}/>
              <text x={pd.cx} y={pd.cy+3} textAnchor="middle" fontSize={uf==='DF'?5:9} fontWeight={500} fill={idx>=3?'#fff':'#374151'} pointerEvents="none">{uf}</text>
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <div style={{position:'fixed',left:tooltip.x+12,top:tooltip.y-10,background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-secondary)',borderRadius:8,padding:'8px 12px',fontSize:12,lineHeight:1.6,pointerEvents:'none',zIndex:99,whiteSpace:'pre-line',boxShadow:'0 2px 8px rgba(0,0,0,.08)'}}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

function BarChart({ items, colorMap }: { items: ChartItem[]; colorMap: Record<string,string> }) {
  if (!items.length) return <p style={{fontSize:13,color:'var(--color-text-secondary)',padding:'1rem 0'}}>—</p>
  const maxV = Math.max(...items.map(i=>i.value))
  return (
    <div>
      {items.map(item => {
        const pct = Math.round(item.value/maxV*100)
        const color = colorMap[item.label]||'#888'
        return (
          <div key={item.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{fontSize:12,color:'var(--color-text-secondary)',width:90,flexShrink:0,textAlign:'right',lineHeight:1.3}}>{item.label}</span>
            <div style={{flex:1,background:'var(--color-background-secondary)',borderRadius:3,height:22,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:'100%',borderRadius:3,background:color+'20',borderLeft:`3px solid ${color}`,display:'flex',alignItems:'center',paddingLeft:7}}>
                <span style={{fontSize:11,fontWeight:500,color,whiteSpace:'nowrap'}}>{fmt(item.value)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function MapeamentoPage() {
  const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID!
  const [data, setData] = useState<MapData|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [modal, setModal] = useState('all')
  const [transportadora, setTransportadora] = useState('all')
  const [centroCusto, setCentroCusto] = useState('all')
  const [mes, setMes] = useState('all')
  const [ano, setAno] = useState('all')
  const [transportadoras, setTransportadoras] = useState<string[]>([])
  const [centrosCusto, setCentrosCusto] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({empresa_id:empresaId})
      if (modal!=='all') params.set('modal',modal)
      if (transportadora!=='all') params.set('transportadora',transportadora)
      if (centroCusto!=='all') params.set('centro_custo',centroCusto)
      if (mes!=='all') params.set('mes',mes)
      if (ano!=='all') params.set('ano',ano)
      const res = await fetch(`/api/remessas/mapeamento?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const json: MapData = await res.json()
      setData(json)
      setTransportadoras(json.transportadoras||[])
      setCentrosCusto(json.centrosCusto||[])
    } catch(e:any) { setError(e.message) }
    finally { setLoading(false) }
  }, [empresaId,modal,transportadora,centroCusto,mes,ano])

  useEffect(()=>{ fetchData() },[fetchData])

  const s = data?.summary
  const card = (style: any) => ({background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,opacity:loading?.5:1,transition:'opacity .2s',...style})

  return (
    <div style={{padding:'1.5rem',fontFamily:'var(--font-sans)'}}>

      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:'1.25rem'}}>
        {[
          {value:modal,set:setModal,label:'Todos os modais',opts:['Rodoviário','Aéreo','Marítimo']},
          {value:transportadora,set:setTransportadora,label:'Todas as transportadoras',opts:transportadoras},
          {value:centroCusto,set:setCentroCusto,label:'Todos os C.C.',opts:centrosCusto},
          {value:mes,set:setMes,label:'Todos os meses',opts:MESES.map((m,i)=>({label:m,value:String(i+1)}))},
          {value:ano,set:setAno,label:'Todo o período',opts:['2026','2025','2024']},
        ].map((f,i)=>(
          <select key={i} value={f.value} onChange={e=>f.set(e.target.value)}
            style={{width:'100%',fontSize:12,padding:'7px 10px',border:'0.5px solid var(--color-border-secondary)',borderRadius:8,background:'var(--color-background-primary)',color:'var(--color-text-primary)',cursor:'pointer'}}>
            <option value="all">{f.label}</option>
            {f.opts.map((o:any)=>typeof o==='string'?<option key={o} value={o}>{o}</option>:<option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>

      {error && <div style={{padding:'1rem',background:'var(--color-background-danger)',color:'var(--color-text-danger)',borderRadius:8,marginBottom:'1rem',fontSize:13}}>Erro: {error}</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:'1.25rem'}}>
        {[
          {label:'Valor total remessas',value:s?fmt(s.totalValue):'—',sub:s?`${s.totalCtes} CT-es · ${s.stateCount} estados`:'—'},
          {label:'Ticket médio / CT-e',value:s?fmt(s.ticketMedio):'—',sub:'por documento'},
          {label:'Estado de maior gasto',value:s?.topState?.name||'—',sub:s?.topState?fmt(s.topState.value):'—'},
        ].map(c=>(
          <div key={c.label} style={{background:'var(--color-background-secondary)',borderRadius:8,padding:'1rem 1.25rem',opacity:loading?.5:1,transition:'opacity .2s'}}>
            <div style={{fontSize:11,fontWeight:500,letterSpacing:'.06em',color:'var(--color-text-secondary)',textTransform:'uppercase',marginBottom:6}}>{c.label}</div>
            <div style={{fontSize:26,fontWeight:500,color:'var(--color-text-primary)',lineHeight:1.15}}>{c.value}</div>
            <div style={{fontSize:12,color:'var(--color-text-secondary)',marginTop:3}}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,overflow:'hidden',marginBottom:'1.25rem'}}>
        <div style={{padding:'1rem',borderRight:'0.5px solid var(--color-border-tertiary)'}}>
          <div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:'.75rem'}}>📍 Gasto por estado de destino</div>
          {loading?<div style={{height:300,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text-secondary)',fontSize:13}}>Carregando...</div>:<BrazilMap byState={data?.byState||[]}/>}
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:'.5rem',fontSize:11,color:'var(--color-text-secondary)'}}>
            <span>Menor</span>
            <div style={{display:'flex',height:7,flex:1,borderRadius:4,overflow:'hidden'}}>{BLUE_STOPS.map(c=><div key={c} style={{flex:1,background:c}}/>)}</div>
            <span>Maior</span>
          </div>
        </div>
        <div style={{padding:'1rem'}}>
          <div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:'.75rem'}}>🏆 Top 8 estados por valor</div>
          {loading?<div style={{color:'var(--color-text-secondary)',fontSize:13}}>Carregando...</div>:(data?.byState||[]).slice(0,8).map(d=>{
            const maxV=data?.byState[0]?.value||1
            const pct=Math.round(d.value/maxV*100)
            return(
              <div key={d.uf} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:500,width:28,color:'var(--color-text-secondary)',textAlign:'right',flexShrink:0}}>{d.uf}</span>
                <div style={{flex:1,background:'var(--color-background-secondary)',borderRadius:3,height:24,overflow:'hidden'}}>
                  <div style={{width:`${pct}%`,height:'100%',borderRadius:3,background:'#dbeafe',display:'flex',alignItems:'center',paddingLeft:8}}>
                    <span style={{fontSize:11,fontWeight:500,color:'#1a56a0',whiteSpace:'nowrap'}}>{fmt(d.value)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:'1.25rem'}}>
        {[
          {title:'🚛 Gasto por modal',items:data?.byModal||[],colorMap:MODAL_COLORS},
          {title:'📋 Por centro de custo',items:data?.byCC||[],colorMap:CC_COLORS},
        ].map(c=>(
          <div key={c.title} style={card({padding:'1rem'})}>
            <div style={{fontSize:12,color:'var(--color-text-secondary)',marginBottom:'.75rem'}}>{c.title}</div>
            <BarChart items={c.items} colorMap={c.colorMap}/>
          </div>
        ))}
      </div>

      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'.75rem 1rem',borderBottom:'0.5px solid var(--color-border-tertiary)',fontSize:12,color:'var(--color-text-secondary)'}}>📊 Detalhamento por estado</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,tableLayout:'fixed'}}>
            <thead>
              <tr style={{background:'var(--color-background-secondary)'}}>
                {[['#',36],['Estado',130],['UF',44],['CT-es',56],['Modal predom.',120],['Valor total',120],['Ticket médio',110],['Participação',110]].map(([h,w],i)=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:i>=3?'right':'left',fontSize:11,fontWeight:500,letterSpacing:'.04em',color:'var(--color-text-secondary)',textTransform:'uppercase',borderBottom:'0.5px solid var(--color-border-tertiary)',width:w}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading?<tr><td colSpan={8} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)',fontSize:13}}>Carregando...</td></tr>
              :!(data?.byState?.length)?<tr><td colSpan={8} style={{padding:'2rem',textAlign:'center',color:'var(--color-text-secondary)',fontSize:13}}>Nenhum resultado para os filtros selecionados</td></tr>
              :(data?.byState||[]).map((d,i)=>{
                const total=s?.totalValue||1
                const pct=Math.round(d.value/total*100)
                const ticket=d.ctes>0?Math.round(d.value/d.ctes):0
                return(
                  <tr key={d.uf} style={{borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                    <td style={{padding:'9px 12px'}}><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:'50%',background:'var(--color-background-secondary)',fontSize:11,fontWeight:500}}>{i+1}</span></td>
                    <td style={{padding:'9px 12px'}}>{d.name}</td>
                    <td style={{padding:'9px 12px',color:'var(--color-text-secondary)'}}>{d.uf}</td>
                    <td style={{padding:'9px 12px',textAlign:'right'}}>{d.ctes}</td>
                    <td style={{padding:'9px 12px',textAlign:'right'}}><span style={{display:'inline-block',fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--color-background-info)',color:'var(--color-text-info)'}}>{d.modal}</span></td>
                    <td style={{padding:'9px 12px',textAlign:'right',fontWeight:500}}>{fmt(d.value)}</td>
                    <td style={{padding:'9px 12px',textAlign:'right'}}>{fmt(ticket)}</td>
                    <td style={{padding:'9px 12px',textAlign:'right'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                        <div style={{width:56,height:6,background:'var(--color-background-secondary)',borderRadius:3,overflow:'hidden',flexShrink:0}}><div style={{width:`${pct}%`,height:'100%',borderRadius:3,background:'#1a56a0'}}/></div>
                        <span style={{fontSize:11,minWidth:28}}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
