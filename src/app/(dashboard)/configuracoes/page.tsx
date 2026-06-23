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
    envio_semanal_ativo: false,
    envio_mensal_ativo: false,
    dia_semana_envio: 1,   // 0=Dom, 1=Seg, ... 6=Sab
    dia_mes_envio: 1,
    hora_envio: 8,
    ultimo_envio_semanal_em: null as string | null,
    ultimo_envio_mensal_em: null as string | null,
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
          emails_relatorio:        data.parametros.emails_relatorio ?? [],
          envio_semanal_ativo:     data.parametros.envio_semanal_ativo ?? false,
          envio_mensal_ativo:      data.parametros.envio_mensal_ativo ?? false,
          dia_semana_envio:        data.parametros.dia_semana_envio ?? 1,
          dia_mes_envio:           data.parametros.dia_mes_envio ?? 1,
          hora_envio:              data.parametros.hora_envio ?? 8,
          ultimo_envio_semanal_em: data.parametros.ultimo_envio_semanal_em ?? null,
          ultimo_envio_mensal_em:  data.parametros.ultimo_envio_mensal_em ?? null,
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

  async function enviarTeste(freq: 'Semanal' | 'Mensal') {
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
        body: JSON.stringify({ empresa_id: EMPRESA_ID, emails_relatorio: params.emails_relatorio }),
      })
      // 2. Dispara o envio
      const res = await fetch('/api/relatorio/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID, frequencia: freq }),
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
          <img src="data:image/png;base64,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" alt="Amerinode" style={{ height: '24px', width: 'auto' }} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8' }}>Gestão de Log</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'CT-e', href: '/ct-e' }, { label: 'Serviços', href: '/servicos' }].map(tab => (
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

          {/* Relatorio SEMANAL */}
          <div style={{ background: '#fff', borderRadius: '12px', border: `1.5px solid ${params.envio_semanal_ativo ? '#2E7D32' : '#E8E6E0'}`, padding: '24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📅 Relatório semanal
              </h2>
              <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px', cursor: 'pointer' }}>
                <input type="checkbox" checked={params.envio_semanal_ativo}
                  onChange={e => setParams(p => ({ ...p, envio_semanal_ativo: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: params.envio_semanal_ativo ? '#2E7D32' : '#C8C6C0', borderRadius: '24px', transition: '.2s' }}>
                  <span style={{ position: 'absolute', height: '18px', width: '18px', left: params.envio_semanal_ativo ? '25px' : '3px', top: '3px', background: '#fff', borderRadius: '50%', transition: '.2s' }} />
                </span>
              </label>
            </div>
            {params.envio_semanal_ativo && (
              <>
                <div style={{ marginBottom: '16px' }}>
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
                {params.ultimo_envio_semanal_em && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                    Último envio semanal: {new Date(params.ultimo_envio_semanal_em).toLocaleString('pt-BR')}
                  </div>
                )}
                <button type="button" onClick={() => enviarTeste('Semanal')} disabled={enviandoTeste || params.emails_relatorio.length === 0}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #2E7D32', background: '#fff', color: '#2E7D32', fontSize: '12px', fontWeight: '600', cursor: enviandoTeste || params.emails_relatorio.length === 0 ? 'not-allowed' : 'pointer', opacity: params.emails_relatorio.length === 0 ? 0.5 : 1 }}>
                  {enviandoTeste ? '📨 Enviando…' : '🧪 Testar relatório semanal agora'}
                </button>
              </>
            )}
          </div>

          {/* Relatorio MENSAL */}
          <div style={{ background: '#fff', borderRadius: '12px', border: `1.5px solid ${params.envio_mensal_ativo ? '#185FA5' : '#E8E6E0'}`, padding: '24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📆 Relatório mensal
              </h2>
              <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px', cursor: 'pointer' }}>
                <input type="checkbox" checked={params.envio_mensal_ativo}
                  onChange={e => setParams(p => ({ ...p, envio_mensal_ativo: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: params.envio_mensal_ativo ? '#185FA5' : '#C8C6C0', borderRadius: '24px', transition: '.2s' }}>
                  <span style={{ position: 'absolute', height: '18px', width: '18px', left: params.envio_mensal_ativo ? '25px' : '3px', top: '3px', background: '#fff', borderRadius: '50%', transition: '.2s' }} />
                </span>
              </label>
            </div>
            {params.envio_mensal_ativo && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>Dia do mês</label>
                  <input type="number" min={1} max={28} value={params.dia_mes_envio}
                    onChange={e => setParams(p => ({ ...p, dia_mes_envio: Math.max(1, Math.min(28, Number(e.target.value))) }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px' }}>De 1 a 28 (cobre o mês fechado anterior).</div>
                </div>
                {params.ultimo_envio_mensal_em && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                    Último envio mensal: {new Date(params.ultimo_envio_mensal_em).toLocaleString('pt-BR')}
                  </div>
                )}
                <button type="button" onClick={() => enviarTeste('Mensal')} disabled={enviandoTeste || params.emails_relatorio.length === 0}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #185FA5', background: '#fff', color: '#185FA5', fontSize: '12px', fontWeight: '600', cursor: enviandoTeste || params.emails_relatorio.length === 0 ? 'not-allowed' : 'pointer', opacity: params.emails_relatorio.length === 0 ? 0.5 : 1 }}>
                  {enviandoTeste ? '📨 Enviando…' : '🧪 Testar relatório mensal agora'}
                </button>
              </>
            )}
          </div>

          {/* Hora de envio (comum aos dois) */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '24px', marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>⏰ Hora de envio (Brasília)</label>
            <select value={params.hora_envio} onChange={e => setParams(p => ({ ...p, hora_envio: Number(e.target.value) }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', background: '#fff', outline: 'none' }}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
            <div style={{ fontSize: '11px', color: '#888780', marginTop: '6px' }}>Hora que o cron vai disparar os relatórios ativos.</div>
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
