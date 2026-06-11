'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import PasswordInput from '@/components/PasswordInput'

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
        <img src="data:image/png;base64,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" alt="Amerinode" style={{ height: '24px', width: 'auto' }} />
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
              <PasswordInput value={senhaAtual} onChange={setSenhaAtual} placeholder="Sua senha atual" required autoComplete="current-password" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Nova senha</label>
              <PasswordInput value={novaSenha} onChange={setNovaSenha} placeholder="Mínimo 6 caracteres" required autoComplete="new-password" />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '6px' }}>Confirmar nova senha</label>
              <PasswordInput value={confirmar} onChange={setConfirmar} placeholder="Repita a nova senha" required autoComplete="new-password" />
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
