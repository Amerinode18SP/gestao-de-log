'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { isAdmin, perfil, sair } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const [aba, setAba] = useState<'alertas' | 'relatorios'>('alertas')
  const [novoEmail, setNovoEmail] = useState('')
  const [enviandoTeste, setEnviandoTeste] = useState(false)

  const [params, setParams] = useState({
    // Alertas
    limite_semanal: 45000,
    limite_mensal: 180000,
    limite_fornecedor_mes: 60000,
    tolerancia_pct: 5,
    email_alertas: '',
    // Relatorios por email
    emails_relatorio: [] as string[],
    frequencia_envio: 'Semanal' as 'Semanal' | 'Mensal',
    dia_semana_envio: 1,   // 0=Dom, 1=Seg, ... 6=Sab
    dia_mes_envio: 1,
    hora_envio: 8,
    ultimo_envio_em: null as string | null,
  })

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/alertas/parametros?empresa_id=${EMPRESA_ID}`)
    if (res.ok) {
      const data = await res.json()
      if (data.parametros) {
        setParams({
          limite_semanal:        data.parametros.limite_semanal ?? 45000,
          limite_mensal:         data.parametros.limite_mensal ?? 180000,
          limite_fornecedor_mes: data.parametros.limite_fornecedor_mes ?? 60000,
          tolerancia_pct:        data.parametros.tolerancia_pct ?? 5,
          email_alertas:         data.parametros.email_alertas ?? '',
          emails_relatorio:      data.parametros.emails_relatorio ?? [],
          frequencia_envio:      data.parametros.frequencia_envio ?? 'Semanal',
          dia_semana_envio:      data.parametros.dia_semana_envio ?? 1,
          dia_mes_envio:         data.parametros.dia_mes_envio ?? 1,
          hora_envio:            data.parametros.hora_envio ?? 8,
          ultimo_envio_em:       data.parametros.ultimo_envio_em ?? null,
        })
      }
    }
  }, [])

  function adicionarEmail() {
    const e = novoEmail.trim().toLowerCase()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setErro('Email inválido'); return
    }
    if (params.emails_relatorio.includes(e)) {
      setErro('Esse email já está na lista'); return
    }
    setParams(p => ({ ...p, emails_relatorio: [...p.emails_relatorio, e] }))
    setNovoEmail('')
    setErro('')
  }

  function removerEmail(email: string) {
    setParams(p => ({ ...p, emails_relatorio: p.emails_relatorio.filter(e => e !== email) }))
  }

  async function enviarTeste() {
    if (!params.emails_relatorio.length) {
      setErro('Cadastre pelo menos 1 email antes de testar')
      return
    }
    setEnviandoTeste(true)
    setErro(''); setMensagem('')
    try {
      // 1. Salva params primeiro (pra ter a lista atualizada no banco)
      await fetch('/api/alertas/parametros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID, emails_relatorio: params.emails_relatorio, frequencia_envio: params.frequencia_envio }),
      })
      // 2. Dispara o envio
      const res = await fetch('/api/relatorio/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID, frequencia: params.frequencia_envio }),
      })
      const data = await res.json()
      if (res.ok) {
        const enviados = (data.destinatarios ?? []).filter((d: any) => d.sent).length
        setMensagem(`✅ Relatório enviado para ${enviados} de ${params.emails_relatorio.length} email(s).`)
      } else {
        setErro(data.error || 'Erro ao enviar teste')
      }
    } catch { setErro('Erro de conexão') }
    setEnviandoTeste(false)
  }

  useEffect(() => { carregar() }, [carregar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setMensagem('')
    setErro('')
    try {
      const res = await fetch('/api/alertas/parametros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID, ...params })
      })
      if (res.ok) {
        setMensagem('✅ Configurações salvas com sucesso!')
      } else {
        const data = await res.json()
        setErro(data.error || 'Erro ao salvar')
      }
    } catch { setErro('Erro de conexão') }
    setSalvando(false)
  }

  const campo = (label: string, key: keyof typeof params, tipo: 'moeda' | 'pct' | 'text' | 'email' | 'select', opcoes?: string[]) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>{label}</label>
      {tipo === 'select' ? (
        <select
          value={params[key] as string}
          onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', background: '#fff', outline: 'none' }}
        >
          {opcoes?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <div style={{ position: 'relative' }}>
          {tipo === 'moeda' && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '13px' }}>R$</span>}
          {tipo === 'pct' && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '13px' }}>%</span>}
          <input
            type={tipo === 'email' ? 'email' : 'number'}
            value={params[key] as string | number}
            onChange={e => setParams(p => ({ ...p, [key]: tipo === 'text' || tipo === 'email' ? e.target.value : Number(e.target.value) }))}
            style={{
              width: '100%', padding: `10px ${tipo === 'pct' ? '36px' : '12px'} 10px ${tipo === 'moeda' ? '36px' : '12px'}`,
              borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1A1916' }}>
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>📦</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8' }}>Gestão de Log</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'CT-e', href: '/dashboard' }, { label: 'Mapeamento', href: '/mapeamento' }, { label: 'Relatórios', href: '/relatorios' }, { label: 'Alertas', href: '/alertas' }].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuAberto(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid #333', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#F0EEE8', fontSize: '12px' }}>
            <span>👤</span>
            <span>{perfil?.nome || 'Usuário'}</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
          </button>
          {menuAberto && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', borderRadius: '10px', border: '1px solid #E8E6E0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EEE8' }}>
                <div style={{ fontSize: '12px', fontWeight: '600' }}>{perfil?.nome}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{perfil?.email}</div>
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => { setMenuAberto(false); router.push('/usuarios') }}
                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                    👥 Gerenciar usuários
                  </button>
                  <button onClick={() => { setMenuAberto(false); router.push('/configuracoes') }}
                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: '#F8F7F4', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', fontWeight: '600' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F0EEE8')}
                    onMouseOut={e => (e.currentTarget.style.background = '#F8F7F4')}>
                    ⚙️ Configurações
                  </button>
                </>
              )}
              <button onClick={() => router.push('/alterar-senha')}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseOver={e => (e.currentTarget.style.background = '#F0EEE8')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                🔑 Alterar senha
              </button>
              <button onClick={sair}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#C62828', borderTop: '1px solid #F0EEE8' }}
                onMouseOver={e => (e.currentTarget.style.background = '#FFF5F5')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>⚙️ Configurações</h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>Alertas de gasto e envio automático de relatórios</p>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #E2E0D8' }}>
          {[
            { id: 'alertas',    label: '🔔 Alertas de gasto' },
            { id: 'relatorios', label: '📧 Relatórios por email' },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => { setAba(t.id as any); setMensagem(''); setErro('') }}
              style={{
                padding: '10px 16px', fontSize: '13px', fontWeight: '500', border: 'none', background: 'none',
                cursor: 'pointer', borderBottom: aba === t.id ? '2px solid #185FA5' : '2px solid transparent',
                color: aba === t.id ? '#185FA5' : '#888', marginBottom: '-1px',
              }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={salvar}>
        {aba === 'alertas' && (
          <>
          {/* Limites de gastos */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💰 Limites de gasto
            </h2>
            {campo('Limite semanal', 'limite_semanal', 'moeda')}
            {campo('Limite mensal total', 'limite_mensal', 'moeda')}
            {campo('Limite por transportadora/mês', 'limite_fornecedor_mes', 'moeda')}
            <div style={{ background: '#F8F7F4', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#666' }}>
              💡 Valores atuais: Semanal {fmt(params.limite_semanal)} · Mensal {fmt(params.limite_mensal)} · Por transportadora {fmt(params.limite_fornecedor_mes)}
            </div>
          </div>

          {/* Tolerância */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎯 Tolerância e notificações
            </h2>
            {campo('Tolerância antes do alerta', 'tolerancia_pct', 'pct')}
            <p style={{ fontSize: '12px', color: '#888', margin: '-12px 0 20px' }}>
              Ex: com limite R$ 45.000 e tolerância 5%, alerta dispara em R$ 47.250
            </p>
            <div style={{ marginBottom: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>
                Emails para alertas de limite estourado
              </label>
              <textarea
                value={params.email_alertas}
                onChange={e => setParams(p => ({ ...p, email_alertas: e.target.value }))}
                placeholder="ana@empresa.com, joao@empresa.com"
                rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px' }}>Separe múltiplos emails com vírgula.</div>
              {params.email_alertas && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {params.email_alertas.split(',').map(e => e.trim()).filter(Boolean).map((email, i) => (
                    <span key={i} style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 10px', borderRadius: '99px', fontSize: '11px' }}>✉️ {email}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          </>
        )}

        {aba === 'relatorios' && (
          <>
          {/* Lista de destinatarios */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✉️ Destinatários
            </h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarEmail() } }}
                placeholder="email@empresa.com.br"
                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none' }} />
              <button type="button" onClick={adicionarEmail}
                style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#185FA5', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                + Adicionar
              </button>
            </div>
            {params.emails_relatorio.length === 0 ? (
              <div style={{ background: '#F8F7F4', borderRadius: '8px', padding: '14px 16px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                Nenhum email cadastrado. Adicione um acima.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {params.emails_relatorio.map(email => (
                  <div key={email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8F7F4', padding: '8px 14px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#1A1916' }}>✉️ {email}</span>
                    <button type="button" onClick={() => removerEmail(email)}
                      style={{ background: 'none', border: 'none', color: '#C62828', fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}>
                      🗑️ Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#888780', marginTop: '12px' }}>
              {params.emails_relatorio.length} destinatário(s) cadastrado(s).
            </div>
          </div>

          {/* Quando enviar */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📅 Quando enviar
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '8px' }}>Frequência</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { v: 'Semanal', label: 'Semanal',  desc: 'Toda semana' },
                  { v: 'Mensal',  label: 'Mensal',   desc: 'Todo mês' },
                ].map(o => (
                  <div key={o.v} onClick={() => setParams(p => ({ ...p, frequencia_envio: o.v as any }))}
                    style={{ padding: '12px', border: `1.5px solid ${params.frequencia_envio === o.v ? '#185FA5' : '#E2E0D8'}`, borderRadius: '8px', cursor: 'pointer', background: params.frequencia_envio === o.v ? '#F0F8FF' : '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: params.frequencia_envio === o.v ? '#0C447C' : '#1A1916' }}>{o.label}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {params.frequencia_envio === 'Semanal' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '8px' }}>Dia da semana</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((nome, i) => (
                    <button type="button" key={i} onClick={() => setParams(p => ({ ...p, dia_semana_envio: i }))}
                      style={{ flex: 1, minWidth: '54px', padding: '10px 6px', borderRadius: '8px', fontSize: '12px', fontWeight: '500',
                        border: `1.5px solid ${params.dia_semana_envio === i ? '#185FA5' : '#E2E0D8'}`,
                        background: params.dia_semana_envio === i ? '#185FA5' : '#fff',
                        color: params.dia_semana_envio === i ? '#fff' : '#444', cursor: 'pointer' }}>
                      {nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {params.frequencia_envio === 'Mensal' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>Dia do mês</label>
                <input type="number" min={1} max={28} value={params.dia_mes_envio}
                  onChange={e => setParams(p => ({ ...p, dia_mes_envio: Math.max(1, Math.min(28, Number(e.target.value))) }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px' }}>De 1 a 28 (pra cair em todos os meses).</div>
              </div>
            )}

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>Hora de envio (Brasília)</label>
              <select value={params.hora_envio} onChange={e => setParams(p => ({ ...p, hora_envio: Number(e.target.value) }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', background: '#fff', outline: 'none' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>

            {params.ultimo_envio_em && (
              <div style={{ marginTop: '14px', fontSize: '12px', color: '#666' }}>
                Último envio: {new Date(params.ultimo_envio_em).toLocaleString('pt-BR')}
              </div>
            )}
          </div>

          {/* Botão de teste */}
          <div style={{ background: '#FFF7E0', borderRadius: '12px', border: '1px solid #F0D080', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px', color: '#6B4500' }}>
              🧪 Testar agora
            </h2>
            <p style={{ fontSize: '12px', color: '#7A5900', margin: '0 0 14px', lineHeight: '1.5' }}>
              Envia o relatório <b>imediatamente</b> para os {params.emails_relatorio.length} email(s) cadastrado(s), com dados dos últimos {params.frequencia_envio === 'Mensal' ? '30 dias' : '7 dias'}. Útil pra você ver como fica antes de deixar automático.
            </p>
            <button type="button" onClick={enviarTeste} disabled={enviandoTeste || params.emails_relatorio.length === 0}
              style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 'none', background: enviandoTeste ? '#85B7EB' : '#185FA5', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: enviandoTeste || params.emails_relatorio.length === 0 ? 'not-allowed' : 'pointer', opacity: params.emails_relatorio.length === 0 ? 0.5 : 1 }}>
              {enviandoTeste ? '📨 Enviando…' : '📨 Enviar relatório de teste agora'}
            </button>
          </div>
          </>
        )}

          {mensagem && (
            <div style={{ background: '#EAF3DE', border: '1px solid #B3D48A', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#27500A' }}>
              {mensagem}
            </div>
          )}
          {erro && (
            <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#C62828' }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => router.back()}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #D8D6D0', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#444' }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: salvando ? '#888' : '#1A1916', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: salvando ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Salvando...' : '💾 Salvar configurações'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
