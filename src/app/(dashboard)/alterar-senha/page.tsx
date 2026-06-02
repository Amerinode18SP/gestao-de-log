'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export default function AlterarSenhaPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowser()
  const { perfil } = useAuth()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setMensagem('')

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    if (senhaAtual === novaSenha) {
      setErro('A nova senha precisa ser diferente da atual.')
      return
    }

    setLoading(true)
    try {
      // 1. Verifica senha atual fazendo signIn com ela
      const email = perfil?.email
      if (!email) {
        setErro('Sessão expirada. Faça login de novo.')
        setLoading(false)
        return
      }
      const { error: signinErr } = await supabase.auth.signInWithPassword({
        email,
        password: senhaAtual,
      })
      if (signinErr) {
        setErro('A senha atual está incorreta.')
        setLoading(false)
        return
      }

      // 2. Atualiza senha
      const { error: updateErr } = await supabase.auth.updateUser({ password: novaSenha })
      if (updateErr) {
        setErro(updateErr.message || 'Erro ao alterar senha.')
        setLoading(false)
        return
      }

      setMensagem('✅ Senha alterada com sucesso!')
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmar('')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px',
    border: '0.5px solid #D4D2CA', borderRadius: '8px',
    outline: 'none', background: '#FAFAF8', boxSizing: 'border-box',
    color: '#1A1916',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1A1916' }}>
      {/* Header simples */}
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>📦</span>
        <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8' }}>Gestão de Log</span>
        <button onClick={() => router.push('/dashboard')} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #555', color: '#F0EEE8', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← Voltar
        </button>
      </header>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>Alterar senha</h1>
        <p style={{ fontSize: '13px', color: '#888780', marginBottom: '28px' }}>
          {perfil?.email && <>Conta: <b>{perfil.email}</b></>}
        </p>

        <div style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid #E2E0D8', padding: '28px' }}>
          {mensagem && (
            <div style={{ background: '#EAF3DE', border: '0.5px solid #B3D48A', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#27500A', marginBottom: '16px' }}>
              {mensagem}
            </div>
          )}
          {erro && (
            <div style={{ background: '#FCEBEB', border: '0.5px solid #E8AEAE', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#791F1F', marginBottom: '16px' }}>
              ⚠️ {erro}
            </div>
          )}

          <form onSubmit={salvar}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Senha atual</label>
              <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                placeholder="Sua senha atual" required style={inputStyle} autoComplete="current-password" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Nova senha</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres" required style={inputStyle} autoComplete="new-password" />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Confirmar nova senha</label>
              <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha" required style={inputStyle} autoComplete="new-password" />
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px', fontSize: '14px', fontWeight: '500',
              background: loading ? '#85B7EB' : '#185FA5', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Salvando...' : 'Alterar senha'}
            </button>
          </form>

          <p style={{ fontSize: '11px', color: '#888780', marginTop: '20px', marginBottom: 0, textAlign: 'center', lineHeight: '1.5' }}>
            Esqueceu a senha atual? Volte para a tela de <a href="/esqueci-senha" style={{ color: '#185FA5' }}>esqueci minha senha</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
