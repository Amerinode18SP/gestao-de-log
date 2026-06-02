// ============================================================
// FREIGHT-MS — Cliente Resend + templates de email
// ============================================================

const FROM_EMAIL = 'gestao-de-log@amerinode.com.br'
const FROM_NAME  = 'Gestão de Log - Amerinode'

interface EnviarParams {
  to: string
  subject: string
  html: string
}

export async function enviarEmail({ to, subject, html }: EnviarParams) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY ausente — email nao enviado')
    return { sent: false, reason: 'no_api_key' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[email] Resend erro:', res.status, data)
      return { sent: false, reason: data?.message || `HTTP ${res.status}` }
    }
    return { sent: true, id: data?.id }
  } catch (e: any) {
    console.error('[email] excecao:', e?.message)
    return { sent: false, reason: e?.message || 'erro de conexao' }
  }
}

// ============================================================
// Template: Convite de novo usuario
// ============================================================
export function templateConvite({ nome, papel, linkAcesso }: { nome: string, papel: string, linkAcesso: string }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Convite para Gestão de Log</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1916">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F4F0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E0D8">
        <tr><td style="background:#185FA5;padding:28px;text-align:center">
          <div style="display:inline-block;background:#fff;width:48px;height:48px;border-radius:10px;line-height:48px;font-size:24px">🚛</div>
          <div style="color:#fff;font-size:18px;font-weight:600;margin-top:10px">Gestão de Log</div>
          <div style="color:#A6C5E0;font-size:12px;margin-top:2px">Amerinode do Brasil</div>
        </td></tr>
        <tr><td style="padding:32px 32px 8px">
          <h1 style="font-size:18px;font-weight:600;color:#1A1916;margin:0 0 12px">Olá, ${escapeHtml(nome)}!</h1>
          <p style="font-size:14px;color:#444441;line-height:1.6;margin:0 0 18px">
            Você foi convidado para acessar o <b>Gestão de Log</b>, o sistema de gestão de fretes e CT-e da Amerinode, com perfil <b>${escapeHtml(papel)}</b>.
          </p>
          <p style="font-size:14px;color:#444441;line-height:1.6;margin:0 0 22px">
            Para definir sua senha de acesso, clica no botão abaixo:
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px">
            <tr><td align="center">
              <a href="${linkAcesso}" style="display:inline-block;background:#185FA5;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:500">
                Definir minha senha
              </a>
            </td></tr>
          </table>
          <p style="font-size:12px;color:#888780;line-height:1.6;margin:0 0 8px">
            Se o botão não funcionar, copia e cola este endereço no navegador:
          </p>
          <p style="font-size:11px;color:#888780;word-break:break-all;background:#FAFAF8;padding:10px 12px;border-radius:6px;border:1px solid #E8E6E0;margin:0 0 22px">
            ${escapeHtml(linkAcesso)}
          </p>
          <p style="font-size:12px;color:#888780;line-height:1.6;margin:0">
            ⏱ Este link é válido por <b>1 hora</b>. Se expirar, peça pra alguém da equipe gerar um novo, ou use a opção <b>"Esqueci minha senha"</b> na tela de login.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#FAFAF8;border-top:1px solid #E8E6E0">
          <p style="font-size:11px;color:#888780;margin:0;line-height:1.5">
            Você está recebendo este email porque alguém da Amerinode cadastrou seu acesso no sistema Gestão de Log. Se isso foi engano, ignore este email — nada acontece.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#888780;margin:14px 0 0">Gestão de Log © ${new Date().getFullYear()}</p>
    </td></tr>
  </table>
</body>
</html>`
}

// ============================================================
// Template: Redefinir senha
// ============================================================
export function templateRedefinirSenha({ linkAcesso }: { linkAcesso: string }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1916">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F4F0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E0D8">
        <tr><td style="background:#185FA5;padding:28px;text-align:center">
          <div style="display:inline-block;background:#fff;width:48px;height:48px;border-radius:10px;line-height:48px;font-size:24px">🚛</div>
          <div style="color:#fff;font-size:18px;font-weight:600;margin-top:10px">Gestão de Log</div>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="font-size:18px;font-weight:600;color:#1A1916;margin:0 0 12px">Redefinir senha</h1>
          <p style="font-size:14px;color:#444441;line-height:1.6;margin:0 0 22px">
            Você solicitou a redefinição da sua senha do Gestão de Log. Clica no botão abaixo para criar uma senha nova.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px">
            <tr><td align="center">
              <a href="${linkAcesso}" style="display:inline-block;background:#185FA5;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:500">
                Redefinir minha senha
              </a>
            </td></tr>
          </table>
          <p style="font-size:12px;color:#888780;line-height:1.6;margin:0 0 8px">Se o botão não funcionar:</p>
          <p style="font-size:11px;color:#888780;word-break:break-all;background:#FAFAF8;padding:10px 12px;border-radius:6px;border:1px solid #E8E6E0;margin:0 0 22px">
            ${escapeHtml(linkAcesso)}
          </p>
          <p style="font-size:12px;color:#888780;line-height:1.6;margin:0">
            ⏱ Válido por 1 hora. Se você não solicitou esta redefinição, ignore — sua senha não muda sem você clicar.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#888780;margin:14px 0 0">Gestão de Log © ${new Date().getFullYear()}</p>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============================================================
// Template: Relatorio periodico (semanal/mensal)
// ============================================================
interface RelatorioParams {
  titulo: string
  periodoLabel: string      // "Semana de 26/05 a 01/06" etc
  kpis: { label: string; valor: string }[]
  topFornecedores: { nome: string; valor: number; ctes: number }[]
  porModal?: { modal: string; valor: number }[]
  porEstado?: { uf: string; valor: number; ctes: number }[]
  totalCtes: number
  appUrl: string
}

export function templateRelatorio(p: RelatorioParams) {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const linha = (label: string, valor: string, idx: number) => `
    <tr style="background:${idx % 2 ? '#FAFAF8' : '#fff'}">
      <td style="padding:10px 14px;font-size:13px;color:#444441">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;font-size:13px;color:#1A1916;text-align:right;font-weight:500">${escapeHtml(valor)}</td>
    </tr>`

  const fornHtml = p.topFornecedores.slice(0, 10).map((f, i) => `
    <tr style="background:${i % 2 ? '#FAFAF8' : '#fff'}">
      <td style="padding:10px 14px;font-size:12px;color:#444441">${escapeHtml(f.nome)}</td>
      <td style="padding:10px 14px;font-size:12px;color:#666;text-align:right">${f.ctes}</td>
      <td style="padding:10px 14px;font-size:12px;color:#1A1916;text-align:right;font-weight:500">${fmt(f.valor)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1916">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F4F0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E0D8">
        <tr><td style="background:#185FA5;padding:24px 32px">
          <div style="color:#fff;font-size:13px;opacity:.85">📊 ${escapeHtml(p.periodoLabel)}</div>
          <div style="color:#fff;font-size:20px;font-weight:600;margin-top:4px">${escapeHtml(p.titulo)}</div>
        </td></tr>

        <tr><td style="padding:24px 32px 8px">
          <h2 style="font-size:14px;font-weight:600;color:#185FA5;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px">Resumo</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${p.kpis.map((k, i) => linha(k.label, k.valor, i)).join('')}
          </table>
        </td></tr>

        ${p.topFornecedores.length ? `
        <tr><td style="padding:24px 32px 8px">
          <h2 style="font-size:14px;font-weight:600;color:#185FA5;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px">Top Fornecedores</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <thead><tr style="background:#185FA5;color:#fff">
              <th style="padding:9px 14px;font-size:11px;text-align:left;font-weight:500">Fornecedor</th>
              <th style="padding:9px 14px;font-size:11px;text-align:right;font-weight:500">CT-e</th>
              <th style="padding:9px 14px;font-size:11px;text-align:right;font-weight:500">Valor</th>
            </tr></thead>
            <tbody>${fornHtml}</tbody>
          </table>
        </td></tr>` : ''}

        <tr><td style="padding:24px 32px;text-align:center">
          <a href="${p.appUrl}/dashboard" style="display:inline-block;background:#185FA5;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:500">
            Ver dashboard completo
          </a>
        </td></tr>

        <tr><td style="padding:16px 32px;background:#FAFAF8;border-top:1px solid #E8E6E0">
          <p style="font-size:11px;color:#888780;margin:0;line-height:1.5">
            Você está recebendo este email porque está na lista de destinatários de relatórios do <b>Gestão de Log</b>.
            Para deixar de receber, peça ao administrador para remover seu email em Configurações.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#888780;margin:14px 0 0">Gestão de Log © ${new Date().getFullYear()}</p>
    </td></tr>
  </table>
</body></html>`
}
