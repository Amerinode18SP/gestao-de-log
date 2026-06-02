'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ConviteInfo {
  valido: boolean
  motivo?: string
  nome?: string
  email?: string
  papel?: string
  expira_em?: string
}

function AceitarConviteContent() {
  const params = useSearchParams()
  const codigo = params.get('codigo')
  const [info, setInfo] = useState<ConviteInfo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [redirecionando, setRedirecionando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!codigo) {
      setErro('Link inválido. O código não foi enviado.')
      setCarregando(false)
      return
    }
    fetch(`/api/convites/aceitar?codigo=${encodeURIComponent(codigo)}`)
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => setErro('Erro ao verificar convite'))
      .finally(() => setCarregando(false))
  }, [codigo])

  async function aceitar() {
    if (!codigo) return
    setRedirecionando(true)
    setErro('')
    try {
      const r = await fetch('/api/convites/aceitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      })
      const d = await r.json()
      if (!r.ok || !d.action_link) {
        setErro(d?.error || 'Erro ao processar convite')
        setRedirecionando(false)
        return
      }
      // Redireciona pro link Supabase real (que ai sim cria sessao
      // e leva pra /redefinir-senha)
      window.location.href = d.action_link
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setRedirecionando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F5F4F0', padding: '16px'
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Cabecalho */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', background: '#185FA5',
            borderRadius: '12px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', marginBottom: '12px'
          }}>🚛</div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1A1916', margin: 0 }}>
            Gestão de Log
          </h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: '6px 0 0' }}>
            Amerinode do Brasil
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid #E2E0D8', padding: '32px' }}>
          {carregando ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '14px', color: '#888780' }}>⏳ Verificando convite…</div>
            </div>
          ) : !info?.valido ? (
            <div>
              <div style={{
                background: '#FCEBEB', border: '0.5px solid #E8AEAE', borderRadius: '8px',
                padding: '14px', fontSize: '13px', color: '#791F1F', marginBottom: '20px', lineHeight: '1.5'
              }}>
                ⚠️ <b>{
                  info?.motivo === 'usado'       ? 'Convite já utilizado' :
                  info?.motivo === 'expirado'    ? 'Convite expirado' :
                  info?.motivo === 'invalidado'  ? 'Convite cancelado' :
                  'Convite inválido'
                }</b><br/>
                {info?.motivo === 'usado'
                  ? 'Este link já foi usado anteriormente. Se você esqueceu sua senha, use a opção "Esqueci minha senha" na tela de login.'
                  : info?.motivo === 'expirado'
                  ? 'Os convites têm validade de 7 dias. Peça ao administrador para enviar um novo.'
                  : info?.motivo === 'invalidado'
                  ? 'Este convite foi cancelado pelo administrador.'
                  : 'O código deste link não foi encontrado. Confirme o link com quem te convidou.'
                }
              </div>
              <Link href="/login" style={{
                display: 'block', width: '100%', padding: '11px',
                background: '#185FA5', color: '#fff', textAlign: 'center',
                borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500'
              }}>
                Ir para o login
              </Link>
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1916', margin: '0 0 6px' }}>
                Olá, {info.nome?.split(' ')[0]}! 👋
              </h2>
              <p style={{ fontSize: '14px', color: '#444441', margin: '0 0 18px', lineHeight: '1.6' }}>
                Você foi convidado para acessar o <b>Gestão de Log</b> com a conta <b>{info.email}</b> e perfil <b>{info.papel}</b>.
              </p>
              <p style={{ fontSize: '13px', color: '#666', margin: '0 0 24px', lineHeight: '1.6' }}>
                Clica no botão abaixo para definir sua senha de acesso e entrar no sistema:
              </p>

              {erro && (
                <div style={{
                  background: '#FCEBEB', border: '0.5px solid #E8AEAE', borderRadius: '8px',
                  padding: '10px 14px', fontSize: '13px', color: '#791F1F', marginBottom: '16px'
                }}>⚠️ {erro}</div>
              )}

              <button onClick={aceitar} disabled={redirecionando}
                style={{
                  width: '100%', padding: '13px', fontSize: '14px', fontWeight: '500',
                  background: redirecionando ? '#85B7EB' : '#185FA5', color: '#fff',
                  border: 'none', borderRadius: '8px',
                  cursor: redirecionando ? 'not-allowed' : 'pointer'
                }}>
                {redirecionando ? 'Carregando…' : 'Definir minha senha'}
              </button>

              <p style={{ fontSize: '11px', color: '#888780', margin: '18px 0 0', textAlign: 'center', lineHeight: '1.5' }}>
                Quando clicar, você será redirecionado para uma tela segura para criar sua senha.
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#888780', marginTop: '16px' }}>
          Gestão de Log © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

export default function AceitarConvitePage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Carregando…</div>}>
      <AceitarConviteContent />
    </Suspense>
  )
}
