'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [linkValido, setLinkValido] = useState<boolean | null>(null) // null = checando
  const [emailUsuario, setEmailUsuario] = useState('')
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  // Verifica se a sessão foi estabelecida pelo link (Supabase detecta o hash da URL)
  useEffect(() => {
    let mounted = true
    async function check() {
      // Aguarda o cliente Supabase processar o hash da URL
      await new Promise(r => setTimeout(r, 400))
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session?.user) {
        setLinkValido(true)
        setEmailUsuario(session.user.email ?? '')
      } else {
        setLinkValido(false)
      }
    }
    check()
    return () => { mounted = false }
  }, [supabase])

  async function handleRedefinir(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })

    if (error) {
      setErro('Não foi possível definir a senha. Provavelmente o link expirou — solicite um novo.')
      setLinkValido(false)
      setLoading(false)
      return
    }

    setSucesso(true)
    setTimeout(() => router.push('/dashboard'), 2500)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px',
    border: '0.5px solid #D4D2CA', borderRadius: '8px',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
    color: '#1A1916',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F5F4F0', padding: '16px'
    }}>
      <style>{`
        input::placeholder { color: #AAAAAA !important; }
        input { color: #1A1916 !important; }
      `}</style>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Cabecalho com nome do sistema */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', background: '#185FA5',
            borderRadius: '12px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '12px'
          }}>🚛</div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1A1916', margin: 0 }}>
            Gestão de Log
          </h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: '6px 0 0' }}>
            Defina sua senha de acesso
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid #E2E0D8', padding: '28px' }}>
          {/* Estado: verificando link */}
          {linkValido === null && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '14px', color: '#888780' }}>⏳ Verificando link…</div>
            </div>
          )}

          {/* Estado: link invalido/expirado */}
          {linkValido === false && !sucesso && (
            <div>
              <div style={{
                background: '#FCEBEB', border: '0.5px solid #E8AEAE', borderRadius: '8px',
                padding: '14px', fontSize: '13px', color: '#791F1F', marginBottom: '20px', lineHeight: '1.5'
              }}>
                ⚠️ <b>Link expirado ou inválido.</b><br/>
                Os links de definição de senha valem por 1 hora e podem ser usados uma vez só. Solicite um novo abaixo.
              </div>
              <Link href="/esqueci-senha" style={{
                display: 'block', width: '100%', padding: '11px',
                background: '#185FA5', color: '#fff', textAlign: 'center',
                borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500',
                marginBottom: '10px',
              }}>
                Solicitar novo link
              </Link>
              <Link href="/login" style={{
                display: 'block', width: '100%', padding: '11px',
                background: '#fff', color: '#185FA5', textAlign: 'center',
                border: '1px solid #B7D4F0', borderRadius: '8px', textDecoration: 'none', fontSize: '14px',
              }}>
                Voltar ao login
              </Link>
            </div>
          )}

          {/* Estado: sucesso */}
          {sucesso && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Senha definida!</h2>
              <p style={{ fontSize: '13px', color: '#888780' }}>Redirecionando…</p>
            </div>
          )}

          {/* Estado: formulario (link valido) */}
          {linkValido === true && !sucesso && (
            <form onSubmit={handleRedefinir}>
              {emailUsuario && (
                <p style={{ fontSize: '12px', color: '#888780', marginBottom: '16px', textAlign: 'center' }}>
                  Conta: <b style={{ color: '#1A1916' }}>{emailUsuario}</b>
                </p>
              )}
              {erro && (
                <div style={{
                  background: '#FCEBEB', border: '0.5px solid #E8AEAE', borderRadius: '8px',
                  padding: '10px 14px', fontSize: '13px', color: '#791F1F', marginBottom: '16px'
                }}>⚠️ {erro}</div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Senha</label>
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required autoFocus
                  style={inputStyle} autoComplete="new-password" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Confirmar senha</label>
                <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repita a senha" required
                  style={inputStyle} autoComplete="new-password" />
              </div>
              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '11px', fontSize: '14px', fontWeight: '500',
                  background: loading ? '#85B7EB' : '#185FA5', color: '#fff',
                  border: 'none', borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}>
                {loading ? 'Salvando…' : 'Salvar senha e entrar'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#888780', marginTop: '16px' }}>
          Gestão de Log © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
