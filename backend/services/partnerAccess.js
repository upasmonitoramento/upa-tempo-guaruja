const { randomBytes, createHash } = require('node:crypto')
const Tokens = require('../models/PartnerToken')
const Partnership = require('../models/CommercialPartnership')
const email = require('../config/recoveryEmail')
const { environment } = require('./commercialPayments')
const { requirementsFor } = require('./partnerRules')
const { entitled } = require('./partnerFunding')
const digest = value => createHash('sha256').update(value).digest('hex')
function site() {
    const url = new URL(process.env.PUBLIC_SITE_ORIGIN || 'https://upa-tempo-guaruja.vercel.app')
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') throw new Error('Invalid public site origin')
    return url.origin
}
async function sendAccess(account, kind) {
    if (!email.configured()) throw Object.assign(new Error('Conecte o envio de email para liberar o acesso dos parceiros.'), { status: 503 })
    const recent = await Tokens.exists({ account: account._id, kind, createdAt: { $gt: new Date(Date.now() - 60000) } })
    if (recent) return
    const token = randomBytes(32).toString('hex')
    await Tokens.deleteMany({ account: account._id, kind })
    await Tokens.create({ _id: digest(token), account: account._id, email: account.email, environment: environment(), kind, expires: new Date(Date.now() + 20 * 60000) })
    try {
        await email.sendMessage(account.email, kind === 'unlock' ? 'Conecta Saúde — acesso bloqueado por segurança' : 'Conecta Saúde — recupere seu acesso de parceiro',
            `${kind === 'unlock' ? 'Seu acesso foi bloqueado após três tentativas de senha incorreta.' : 'Recebemos uma solicitação para recuperar seu acesso.'}\n\nAbra o link abaixo para validar seu email e criar uma nova senha. Ele expira em 20 minutos e funciona uma vez:\n${site()}/parceiro.html#${kind}=${token}\n\nSe você não fez a solicitação, não compartilhe o link.`)
    } catch (error) { await Tokens.deleteOne({ _id: digest(token) }); throw error }
}
async function sendInvite(p, force = false) {
    if (!email.configured()) throw Object.assign(new Error('Conecte o envio de email antes de convidar o parceiro.'), { status: 503 })
    if (p.portalPaused || !entitled(p) || p.fundingType !== 'courtesy' && !p.accepted || p.portalVersion !== 1 || ![14, 28].includes(p.durationDays)) throw Object.assign(new Error('O convite exige uma parceria elegível, com duração de 14/28 dias e pagamento recebido ou cortesia autorizada.'), { status: 409 })
    if (p.accessSentAt && !force) return
    if (p.accessSentAt && Date.now() - +new Date(p.accessSentAt) < 60000) throw Object.assign(new Error('Aguarde um minuto antes de reenviar o convite.'), { status: 429 })
    const now = new Date()
    const claim = await Partnership.updateOne({ _id: p._id || p.id, $or: [{ accessSendingUntil: null }, { accessSendingUntil: { $lt: now } }] }, { $set: { accessSendingUntil: new Date(+now + 60000) } })
    if (!claim.modifiedCount) throw Object.assign(new Error('O convite já está sendo enviado.'), { status: 409 })
    const token = randomBytes(32).toString('hex')
    try {
        const requirements = p.requirements?.length ? p.requirements : await requirementsFor(p.positions)
        await Tokens.deleteMany({ partnership: p._id || p.id, kind: 'invite' })
        await Tokens.create({ _id: digest(token), partnership: p._id || p.id, email: p.email, environment: environment(), kind: 'invite', expires: new Date(+now + 60 * 60000) })
        await email.sendMessage(p.email, 'Conecta Saúde — ative seu portal do parceiro', `${p.fundingType === 'courtesy' ? 'Uma cortesia foi autorizada para a parceria' : 'O pagamento foi recebido para a parceria'} ${p.packageName}.\n\nValide este email e crie sua senha pelo link abaixo:\n${site()}/parceiro.html#invite=${token}\n\nO link expira em uma hora e funciona uma vez. No portal você poderá enviar suas artes e acompanhar a revisão. O anúncio só será publicado após aprovação.`)
        await Partnership.updateOne({ _id: p._id || p.id }, { $set: { accessSentAt: now, requirements }, $unset: { accessSendingUntil: 1 } })
    } catch (error) {
        await Tokens.deleteOne({ _id: digest(token) })
        await Partnership.updateOne({ _id: p._id || p.id }, { $unset: { accessSendingUntil: 1 } })
        throw error
    }
}
module.exports = { sendInvite, sendAccess, digest }
