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
// Template: Relatorio periodico (semanal/mensal) — visual com gráficos
// ============================================================
interface RelatorioParams {
  periodoLabel: string
  totalGasto: number
  mediaMensal: number
  totalCtes: number
  ticketMedio: number
  gastosAnual: { label: string; valor: number }[]                  // jan ate mes atual
  porDiaSemana: { label: string; valor: number }[]                 // seg-sex do mes atual
  mesAtualLabel: string
  porTransportadora: { nome: string; valor: number; ctes: number }[]
  porCentroCusto: { nome: string; valor: number }[]
}

const fmtR = (v: number) => 'R$ ' + Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtN = (v: number) => Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Card de KPI em estilo de tabela (compatível com qualquer email client)
function kpiCard(label: string, valor: string, cor: string) {
  return `
    <td style="padding:0 6px 12px 0;vertical-align:top" width="25%">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff;border:1px solid #E2E0D8;border-radius:8px">
        <tr><td style="padding:12px 14px">
          <div style="font-size:11px;color:#666;margin-bottom:4px">${escapeHtml(label)}</div>
          <div style="font-size:18px;font-weight:700;color:${cor}">${escapeHtml(valor)}</div>
        </td></tr>
      </table>
    </td>`
}

// Barra vertical (gráfico). totalColunas = quantas colunas vão lado a lado.
// Usa <table bgcolor height> em vez de <div height> pra renderizar em
// Outlook desktop (Outlook ignora style="height" em div).
function colunaBarra(label: string, valor: number, max: number, totalColunas: number, cor = '#185FA5') {
  const alturaPx = max > 0 && valor > 0 ? Math.max(2, Math.round((valor / max) * 130)) : 2
  const espacoPx = 132 - alturaPx
  const w = Math.floor(100 / Math.max(totalColunas, 1))
  return `
    <td valign="bottom" style="padding:0 3px;text-align:center" width="${w}%">
      <div style="font-size:9px;color:#666;margin-bottom:4px;white-space:nowrap">${fmtN(valor)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="28">
        <tr><td height="${espacoPx}" style="font-size:1px;line-height:1px">&nbsp;</td></tr>
        <tr><td bgcolor="${cor}" height="${alturaPx}" style="background-color:${cor};font-size:1px;line-height:1px">&nbsp;</td></tr>
      </table>
      <div style="font-size:10px;color:#888;margin-top:6px">${escapeHtml(label)}</div>
    </td>`
}

// Linha de ranking com barra horizontal proporcional
function rankingLinha(nome: string, valor: number, total: number, idx: number, cor: string) {
  const pct = total > 0 ? Math.round((valor / total) * 1000) / 10 : 0
  const barraW = total > 0 ? Math.max(2, Math.round((valor / total) * 100)) : 0
  return `
    <tr><td style="padding:9px 0 4px;font-size:11px;color:#1A1916;font-weight:500">${escapeHtml(nome.length > 40 ? nome.slice(0, 38) + '…' : nome)}</td>
        <td style="padding:9px 0 4px;font-size:11px;color:#666;text-align:right;white-space:nowrap">${pct.toString().replace('.', ',')}% — ${fmtR(valor)}</td></tr>
    <tr><td colspan="2" style="padding:0 0 6px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0EEE8;border-radius:2px"><tr>
        <td style="width:${barraW}%;background:${cor};height:6px;border-radius:2px;line-height:0;font-size:0">&nbsp;</td>
        <td style="width:${100-barraW}%;line-height:0;font-size:0">&nbsp;</td>
      </tr></table>
    </td></tr>`
}

const CORES_RANKING = ['#2E7D32', '#558B2F', '#9E9D24', '#F57F17', '#E65100', '#C62828', '#AD1457', '#6A1B9A']

export function templateRelatorio(p: RelatorioParams) {
  const maxMes = Math.max(...p.gastosAnual.map(m => m.valor), 1)
  const maxDia = Math.max(...p.porDiaSemana.map(m => m.valor), 1)
  const totalT = p.porTransportadora.reduce((s, x) => s + x.valor, 0)
  const totalC = p.porCentroCusto.reduce((s, x) => s + x.valor, 0)

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1916">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F4F0;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E0D8">

        <!-- Header -->
        <tr><td style="background:#185FA5;padding:22px 28px">
          <div style="color:#fff;font-size:12px;opacity:.85">📊 Relatório · ${escapeHtml(p.periodoLabel)}</div>
          <div style="color:#fff;font-size:18px;font-weight:600;margin-top:4px">Gestão de Log — Amerinode</div>
        </td></tr>

        <!-- KPIs em 4 cards -->
        <tr><td style="padding:20px 22px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            ${kpiCard('Total gasto',  fmtR(p.totalGasto),  '#2E7D32')}
            ${kpiCard('Média mensal', fmtR(p.mediaMensal), '#185FA5')}
            ${kpiCard('CT-e emitidas', String(p.totalCtes), '#1A1916')}
            ${kpiCard('Ticket médio', fmtR(p.ticketMedio), '#E65100')}
          </tr></table>
        </td></tr>

        <!-- Gráfico ANUAL: gastos por mês (jan ate mes atual) -->
        ${p.gastosAnual.length ? `
        <tr><td style="padding:8px 28px 18px">
          <div style="background:#FAFAF8;padding:18px;border:1px solid #E8E6E0;border-radius:8px">
            <div style="font-size:13px;font-weight:600;color:#1A1916;margin-bottom:14px">Gastos por mês — ano corrente</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              ${p.gastosAnual.map(m => colunaBarra(m.label, m.valor, maxMes, p.gastosAnual.length, '#185FA5')).join('')}
            </tr></table>
          </div>
        </td></tr>` : ''}

        <!-- Gráfico POR DIA DA SEMANA (mes atual) -->
        ${p.porDiaSemana.length ? `
        <tr><td style="padding:8px 28px 18px">
          <div style="background:#FAFAF8;padding:18px;border:1px solid #E8E6E0;border-radius:8px">
            <div style="font-size:13px;font-weight:600;color:#1A1916;margin-bottom:4px">CT-e por dia da semana</div>
            <div style="font-size:11px;color:#888;margin-bottom:14px">${escapeHtml(p.mesAtualLabel)} — só dias úteis</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              ${p.porDiaSemana.map(d => colunaBarra(d.label, d.valor, maxDia, p.porDiaSemana.length, '#2E7D32')).join('')}
            </tr></table>
          </div>
        </td></tr>` : ''}

        <!-- Por transportadora -->
        ${p.porTransportadora.length ? `
        <tr><td style="padding:8px 28px 18px">
          <div style="background:#fff;padding:18px;border:1px solid #E8E6E0;border-radius:8px">
            <div style="font-size:13px;font-weight:600;color:#1A1916;margin-bottom:12px">Por transportadora</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${p.porTransportadora.slice(0,8).map((t, i) => rankingLinha(t.nome, t.valor, totalT, i, CORES_RANKING[i % CORES_RANKING.length])).join('')}
            </table>
          </div>
        </td></tr>` : ''}

        <!-- Por centro de custo -->
        ${p.porCentroCusto.length ? `
        <tr><td style="padding:8px 28px 22px">
          <div style="background:#fff;padding:18px;border:1px solid #E8E6E0;border-radius:8px">
            <div style="font-size:13px;font-weight:600;color:#1A1916;margin-bottom:12px">Por centro de custo</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${p.porCentroCusto.slice(0,8).map((c, i) => rankingLinha(c.nome, c.valor, totalC, i, CORES_RANKING[i % CORES_RANKING.length])).join('')}
            </table>
          </div>
        </td></tr>` : ''}

        <!-- Footer -->
        <tr><td style="padding:16px 28px;background:#FAFAF8;border-top:1px solid #E8E6E0">
          <p style="font-size:11px;color:#888780;margin:0;line-height:1.5">
            Relatório automático do sistema <b>Gestão de Log</b> da Amerinode. Os números cobrem o período citado no topo, considerando CT-e com status Faturado ou Recebido. Para alterar a lista de destinatários ou a frequência, peça ao administrador.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#888780;margin:14px 0 0">Gestão de Log © ${new Date().getFullYear()}</p>
    </td></tr>
  </table>
</body></html>`
}
