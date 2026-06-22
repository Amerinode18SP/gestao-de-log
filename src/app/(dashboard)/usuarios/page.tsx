'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import PasswordInput from '@/components/PasswordInput'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'

interface Usuario {
  id: string
  nome: string
  email: string
  papel: 'administrador' | 'visualizador'
  ativo: boolean
  criado_em: string
}

const PAPEL_COR: Record<string, { bg: string; color: string }> = {
  administrador: { bg: '#E6F1FB', color: '#0C447C' },
  visualizador:  { bg: '#EAF3DE', color: '#27500A' },
}

export default function UsuariosPage() {
  const router = useRouter()
  const { isAdmin, perfil, sair } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [menuAberto, setMenuAberto] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoPapel, setNovoPapel] = useState<'administrador' | 'visualizador'>('visualizador')
  const [enviando, setEnviando] = useState(false)
  const [reenviando, setReenviando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [linkConvite, setLinkConvite] = useState<{ email: string, url: string, emailEnviado: boolean } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [modalSenha, setModalSenha] = useState<Usuario | null>(null)
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null)
  const [modalExcluir, setModalExcluir] = useState<Usuario | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [editNome, setEditNome] = useState('')
  const [processando, setProcessando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch(`/api/usuarios?empresa_id=${EMPRESA_ID}`)
      if (res.ok) {
        const data = await res.json()
        setUsuarios(data.usuarios ?? [])
      }
    } catch (e) { console.error(e) }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function convidar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    setMensagem('')
    setLinkConvite(null)
    try {
      const res = await fetch('/api/usuarios/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: novoEmail, nome: novoNome, papel: novoPapel, empresa_id: EMPRESA_ID })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.email_enviado) {
          setMensagem(`✅ Email de convite enviado para ${novoEmail}`)
        } else {
          setMensagem(`⚠ Conta criada para ${novoEmail}, mas email não saiu (${data.message?.match(/\((.+)\)/)?.[1] || 'verifique RESEND_API_KEY'}). Copie o link abaixo e mande manualmente.`)
        }
        if (data.action_link) {
          setLinkConvite({ email: novoEmail, url: data.action_link, emailEnviado: !!data.email_enviado })
        }
        setNovoEmail(''); setNovoNome(''); setNovoPapel('visualizador')
        setModalAberto(false)
        carregar()
      } else {
        setErro(data.error || 'Erro ao convidar usuário')
      }
    } catch { setErro('Erro de conexão') }
    setEnviando(false)
  }

  async function reenviarConvite(u: Usuario) {
    setReenviando(u.id)
    setErro('')
    setMensagem('')
    setLinkConvite(null)
    try {
      const res = await fetch('/api/usuarios/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, nome: u.nome, papel: u.papel, empresa_id: EMPRESA_ID })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.email_enviado) {
          setMensagem(`✅ Email de convite reenviado para ${u.email}`)
        } else {
          setMensagem(`⚠ Conta recriada para ${u.email}, mas email não saiu (${data.message?.match(/\((.+)\)/)?.[1] || 'verifique RESEND_API_KEY'}). Copie o link abaixo.`)
        }
        if (data.action_link) {
          setLinkConvite({ email: u.email, url: data.action_link, emailEnviado: !!data.email_enviado })
        }
      } else {
        setErro(data.error || 'Erro ao reenviar convite')
      }
    } catch { setErro('Erro de conexão') }
    setReenviando(null)
  }

  async function copiarLink() {
    if (!linkConvite) return
    try {
      await navigator.clipboard.writeText(linkConvite.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {}
  }

  async function definirSenha() {
    if (!modalSenha) return
    if (!novaSenha || novaSenha.length < 6) {
      setErro('Senha deve ter pelo menos 6 caracteres'); return
    }
    setProcessando(true); setErro(''); setMensagem('')
    try {
      const res = await fetch('/api/usuarios/senha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modalSenha.id, senha: novaSenha })
      })
      const data = await res.json()
      if (res.ok) {
        setMensagem(`✅ Senha definida para ${modalSenha.nome}. Avise a pessoa.`)
        setModalSenha(null); setNovaSenha('')
      } else { setErro(data.error || 'Erro ao definir senha') }
    } catch { setErro('Erro de conexão') }
    setProcessando(false)
  }

  async function salvarEdicao() {
    if (!modalEditar || !editNome.trim()) return
    setProcessando(true); setErro(''); setMensagem('')
    try {
      const res = await fetch('/api/usuarios', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modalEditar.id, nome: editNome.trim() })
      })
      if (res.ok) {
        setMensagem(`✅ Nome atualizado`)
        setModalEditar(null); setEditNome('')
        carregar()
      } else { const d = await res.json(); setErro(d.error || 'Erro ao editar') }
    } catch { setErro('Erro de conexão') }
    setProcessando(false)
  }

  async function excluirUsuario() {
    if (!modalExcluir) return
    setProcessando(true); setErro(''); setMensagem('')
    try {
      const res = await fetch(`/api/usuarios?id=${modalExcluir.id}`, { method: 'DELETE' })
      if (res.ok) {
        setMensagem(`✅ Usuário ${modalExcluir.nome} excluído`)
        setModalExcluir(null)
        carregar()
      } else { const d = await res.json(); setErro(d.error || 'Erro ao excluir') }
    } catch { setErro('Erro de conexão') }
    setProcessando(false)
  }

  async function alterarPapel(id: string, papel: string) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, papel })
    })
    carregar()
  }

  async function alterarAtivo(id: string, ativo: boolean) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ativo })
    })
    carregar()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1A1916' }}>
      {/* Header */}
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="data:image/png;base64,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" alt="Amerinode" style={{ height: '24px', width: 'auto' }} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8' }}>Gestão de Log</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'CT-e', href: '/ct-e' }, { label: 'Mapeamento', href: '/mapeamento' }, { label: 'Serviços', href: '/servicos' }, { label: 'Relatórios', href: '/relatorios' }, { label: 'Alertas', href: '/alertas' }].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
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
                    {perfil?.papel === 'administrador' ? '👑 Administrador' : '👁 Visualizador'}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => { setMenuAberto(false); router.push('/usuarios') }}
                  style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                  onMouseOut={e => (e.currentTarget.style.background = 'none')}
                >
                  👥 Gerenciar usuários
                </button>
              )}
              <button onClick={() => router.push('/alterar-senha')}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseOver={e => (e.currentTarget.style.background = '#F0EEE8')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                🔑 Alterar senha
              </button>
              <button onClick={sair}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#C62828', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #F0EEE8' }}
                onMouseOver={e => (e.currentTarget.style.background = '#FFF5F5')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>Usuários</h1>
            <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>Gerencie acessos e perfis da equipe</p>
          </div>
          {isAdmin && (
            <button onClick={() => { setModalAberto(true); setErro(''); setMensagem('') }}
              style={{ background: '#1A1916', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              + Convidar usuário
            </button>
          )}
        </div>

        {mensagem && (
          <div style={{ background: '#EAF3DE', border: '1px solid #B3D48A', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#27500A' }}>
            {mensagem}
          </div>
        )}

        {linkConvite && (
          <div style={{
            background: linkConvite.emailEnviado ? '#EAF3DE' : '#FFF7E0',
            border: `1px solid ${linkConvite.emailEnviado ? '#B3D48A' : '#F0D080'}`,
            borderRadius: '8px', padding: '16px 20px', marginBottom: '16px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: linkConvite.emailEnviado ? '#27500A' : '#6B4500', marginBottom: '6px' }}>
              {linkConvite.emailEnviado ? '📧 Email enviado!' : '📋 Link de acesso (email não saiu)'} — {linkConvite.email}
            </div>
            <div style={{ fontSize: '12px', color: linkConvite.emailEnviado ? '#3A6E1A' : '#7A5900', marginBottom: '10px', lineHeight: '1.5' }}>
              {linkConvite.emailEnviado
                ? <>O email foi enviado pelo Resend (gestao-de-log@amerinode.com.br). Pode demorar até 1 min e às vezes cai no spam na primeira vez. Se ela não receber, copie o link abaixo e mande direto.</>
                : <>O email não foi enviado (provavelmente <b>RESEND_API_KEY</b> ausente no Vercel). Copie o link abaixo e mande manualmente via WhatsApp/email/Teams. Configure o Vercel pro próximo convite sair automático.</>
              }
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <input
                type="text"
                readOnly
                value={linkConvite.url}
                onFocus={e => e.currentTarget.select()}
                style={{ flex: 1, padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', border: '1px solid #D4C080', borderRadius: '6px', background: '#fff', color: '#444', outline: 'none' }}
              />
              <button
                onClick={copiarLink}
                style={{ padding: '0 16px', fontSize: '13px', fontWeight: '500', background: copiado ? '#27500A' : '#185FA5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {copiado ? '✅ Copiado!' : '📋 Copiar'}
              </button>
              <button
                onClick={() => setLinkConvite(null)}
                style={{ padding: '0 14px', fontSize: '13px', background: 'transparent', color: '#888', border: '1px solid #D8D6D0', borderRadius: '6px', cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {erro && (
          <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#C62828' }}>
            {erro}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Membros da equipe</span>
            <span style={{ fontSize: '12px', color: '#888780' }}>{usuarios.length} usuário(s)</span>
          </div>

          {carregando ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Carregando...</div>
          ) : usuarios.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Nenhum usuário cadastrado.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8F7F4' }}>
                  {['Usuário', 'Email', 'Papel', 'Status', ...(isAdmin ? ['Ações'] : [])].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#555', fontSize: '12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u, i) => {
                  const cor = PAPEL_COR[u.papel] || PAPEL_COR.visualizador
                  const isSelf = u.id === perfil?.id
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                        {u.nome} {isSelf && <span style={{ fontSize: '10px', color: '#888', background: '#F0EEE8', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>você</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...cor, padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500' }}>
                          {u.papel === 'administrador' ? '👑 Administrador' : '👁 Visualizador'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: u.ativo ? '#EAF3DE' : '#F1EFE8', color: u.ativo ? '#27500A' : '#888', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500' }}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '12px 16px' }}>
                          {!isSelf && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <select
                                value={u.papel}
                                onChange={e => alterarPapel(u.id, e.target.value)}
                                style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid #D8D6D0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
                              >
                                <option value="administrador">Administrador</option>
                                <option value="visualizador">Visualizador</option>
                              </select>
                              <button onClick={() => alterarAtivo(u.id, !u.ativo)}
                                style={{ padding: '4px 10px', fontSize: '11px', border: `1px solid ${u.ativo ? '#E8AEAE' : '#D4D2CA'}`, borderRadius: '6px', background: '#fff', cursor: 'pointer', color: u.ativo ? '#791F1F' : '#444' }}>
                                {u.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                              <button
                                onClick={() => reenviarConvite(u)}
                                disabled={reenviando === u.id}
                                style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #C7D2FE', borderRadius: '6px', background: '#F0F4FF', cursor: reenviando === u.id ? 'not-allowed' : 'pointer', color: '#4f46e5', fontWeight: '500' }}>
                                {reenviando === u.id ? 'Enviando...' : '✉ Reenviar convite'}
                              </button>
                              <button
                                onClick={() => { setModalSenha(u); setNovaSenha('') }}
                                style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #B7D4F0', borderRadius: '6px', background: '#F0F8FF', cursor: 'pointer', color: '#0C447C', fontWeight: '500' }}>
                                🔑 Definir senha
                              </button>
                              <button
                                onClick={() => { setModalEditar(u); setEditNome(u.nome) }}
                                style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #D8D6D0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#444', fontWeight: '500' }}>
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => setModalExcluir(u)}
                                style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #E8AEAE', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', color: '#791F1F', fontWeight: '500' }}>
                                🗑️ Excluir
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal: definir senha (admin) */}
      {modalSenha && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>🔑 Definir senha</h2>
              <button onClick={() => { setModalSenha(null); setNovaSenha('') }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px', lineHeight: '1.5' }}>
              Você está definindo a senha para <b>{modalSenha.nome}</b> ({modalSenha.email}). Use só em emergência (a pessoa não consegue receber o link de redefinição). Avise a senha pessoalmente — ela pode trocar depois em Alterar senha.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <PasswordInput value={novaSenha} onChange={setNovaSenha} placeholder="Mínimo 6 caracteres" autoFocus autoComplete="new-password" />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalSenha(null); setNovaSenha('') }}
                style={{ padding: '9px 16px', fontSize: '13px', border: '1px solid #D8D6D0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={definirSenha} disabled={processando}
                style={{ padding: '9px 16px', fontSize: '13px', fontWeight: '500', background: '#185FA5', color: '#fff', border: 'none', borderRadius: '8px', cursor: processando ? 'not-allowed' : 'pointer' }}>
                {processando ? 'Salvando...' : 'Definir senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: editar usuario */}
      {modalEditar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>✏️ Editar usuário</h2>
              <button onClick={() => { setModalEditar(null); setEditNome('') }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '14px' }}>
              Editando <b>{modalEditar.email}</b>. O email não pode ser alterado — pra mudar email, exclua e convide de novo.
            </p>
            <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '5px' }}>Nome</label>
            <input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome completo" autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalEditar(null); setEditNome('') }}
                style={{ padding: '9px 16px', fontSize: '13px', border: '1px solid #D8D6D0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarEdicao} disabled={processando || !editNome.trim()}
                style={{ padding: '9px 16px', fontSize: '13px', fontWeight: '500', background: '#185FA5', color: '#fff', border: 'none', borderRadius: '8px', cursor: processando ? 'not-allowed' : 'pointer' }}>
                {processando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: excluir usuario */}
      {modalExcluir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#791F1F' }}>🗑️ Excluir usuário</h2>
              <button onClick={() => setModalExcluir(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            <div style={{ background: '#FFF5F5', border: '1px solid #E8AEAE', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#791F1F', margin: 0, lineHeight: '1.5' }}>
                Tem certeza que quer excluir <b>{modalExcluir.nome}</b> ({modalExcluir.email})?<br/>
                Essa ação não pode ser desfeita. A pessoa perderá o acesso e os dados de perfil dela serão removidos. Se quiser apenas suspender, use <b>Desativar</b>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalExcluir(null)}
                style={{ padding: '9px 16px', fontSize: '13px', border: '1px solid #D8D6D0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={excluirUsuario} disabled={processando}
                style={{ padding: '9px 16px', fontSize: '13px', fontWeight: '500', background: '#791F1F', color: '#fff', border: 'none', borderRadius: '8px', cursor: processando ? 'not-allowed' : 'pointer' }}>
                {processando ? 'Excluindo...' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal convidar */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Convidar usuário</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>

            <form onSubmit={convidar}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '5px' }}>Nome</label>
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)} required placeholder="Nome completo"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '5px' }}>Email</label>
                <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} required placeholder="email@empresa.com"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Perfil de acesso</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { valor: 'administrador', label: '👑 Administrador', desc: 'Acesso total' },
                    { valor: 'visualizador', label: '👁 Visualizador', desc: 'Só leitura' },
                  ].map(p => (
                    <div key={p.valor} onClick={() => setNovoPapel(p.valor as any)}
                      style={{ padding: '12px', border: `1.5px solid ${novoPapel === p.valor ? '#1A1916' : '#E2E0D8'}`, borderRadius: '8px', cursor: 'pointer', background: novoPapel === p.valor ? '#F8F7F4' : '#fff', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', marginBottom: '2px' }}>{p.label}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalAberto(false)}
                  style={{ padding: '9px 16px', fontSize: '13px', border: '1px solid #D8D6D0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviando}
                  style={{ padding: '9px 16px', fontSize: '13px', fontWeight: '600', background: enviando ? '#888' : '#1A1916', color: '#fff', border: 'none', borderRadius: '8px', cursor: enviando ? 'not-allowed' : 'pointer' }}>
                  {enviando ? 'Enviando...' : 'Enviar convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
