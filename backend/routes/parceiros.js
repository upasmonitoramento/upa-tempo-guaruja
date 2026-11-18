const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const multer = require('multer')
const Account = require('../models/PartnerAccount')
const Token = require('../models/PartnerToken')
const Partnership = require('../models/CommercialPartnership')
const partnerAuth = require('../middlewares/partnerAuth')
const emailService = require('../config/recoveryEmail')
const access = require('../services/partnerAccess')
const payments = require('../services/commercialPayments')
const { webURL } = require('../services/partnerRules')
const media = require('../services/partnerMedia')
const r2 = require('../config/r2')
const router = express.Router()
const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' } })
const dummyPassword = '$2b$10$mJEfJtK8mMAOox7lIQrZqOjU/F9iQsWV5NJ0AL9Aa.b3.rWBou/u.'
const emailOf = value => typeof value === 'string' && value.length <= 160 ? value.trim().toLowerCase() : ''
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const validPassword = value => typeof value === 'string' && value.trim().length >= 8 && Buffer.byteLength(value) <= 72
const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const accountView = a => ({ id: a._id, name: a.name, email: a.email, verifiedAt: a.verifiedAt })
const session = a => ({ token: jwt.sign({ sub: String(a._id), version: a.sessionVersion || 0, environment: payments.environment() }, process.env.JWT_SECRET, { audience: 'conecta-partner', expiresIn: '2h' }), account: accountView(a) })
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }).single('file')
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
router.get('/config', (req, res) => res.json({ emailReady: emailService.configured(), environment: payments.environment() }))

router.post('/login', authLimit, async (req, res) => {
    if (!process.env.JWT_SECRET) return res.status(503).json({ erro: 'Acesso temporariamente indisponível.' })
    const email = emailOf(req.body.email), password = req.body.password
    if (!validEmail(email) || typeof password !== 'string' || Buffer.byteLength(password) > 72) return res.status(400).json({ erro: 'Confira seu email e sua senha.' })
    const account = await Account.findOne({ email, environment: payments.environment() }).select('+password +failedLogins +sessionVersion')
    const matches = await bcrypt.compare(password, account?.password || dummyPassword)
    const denied = () => res.status(401).json({ erro: 'Não foi possível entrar. Confira os dados ou solicite um link de recuperação por email.' })
    if (!account || !account.active || !account.verifiedAt || account.lockedAt) return denied()
    if (!matches) {
        const failed = await Account.findOneAndUpdate({ _id: account._id, lockedAt: null }, { $inc: { failedLogins: 1 } }, { returnDocument: 'after' }).select('+failedLogins')
        if (failed?.failedLogins >= 3) {
            const locked = await Account.updateOne({ _id: account._id, lockedAt: null, failedLogins: { $gte: 3 } }, { $set: { lockedAt: new Date() }, $inc: { sessionVersion: 1 } })
            if (locked.modifiedCount) {
                try { await access.sendAccess(account, 'unlock') } catch (error) { console.error('Email de desbloqueio:', error.name) }
            }
        }
        return denied()
    }
    const confirmed = await Account.updateOne({ _id: account._id, lockedAt: null, sessionVersion: account.sessionVersion || 0 }, { $set: { failedLogins: 0 } })
    if (!confirmed.matchedCount) return denied()
    res.json(session(account))
})

router.post('/acesso/solicitar', authLimit, async (req, res) => {
    if (!emailService.configured()) return res.status(503).json({ erro: 'O envio de email ainda está sendo conectado. Seu acesso será enviado após a confirmação do pagamento.' })
    const email = emailOf(req.body.email)
    if (!validEmail(email)) return res.status(400).json({ erro: 'Informe um email válido.' })
    const account = await Account.findOne({ email, environment: payments.environment(), active: true })
    if (account) await access.sendAccess(account, 'reset')
    else {
        const p = await Partnership.findOne({ email, paymentStatus: 'RECEIVED', portalVersion: 1 }).sort({ createdAt: -1 })
        if (p) { await payments.requireReceived(p); await access.sendInvite(p, true) }
    }
    res.json({ msg: 'Se houver uma parceria elegível com esse email, enviaremos um link. Confira também o spam.' })
})

async function findToken(value) {
    if (typeof value !== 'string' || !/^[a-f\d]{64}$/.test(value)) return null
    return Token.findOne({ _id: access.digest(value), environment: payments.environment(), expires: { $gt: new Date() } })
}
router.post('/link/consultar', authLimit, async (req, res) => {
    const token = await findToken(req.body.token)
    if (!token) return res.status(410).json({ erro: 'Este link expirou ou já foi utilizado. Solicite outro link por email.' })
    const account = await Account.findOne({ email: token.email, environment: payments.environment() })
    const p = token.kind === 'invite' ? await Partnership.findById(token.partnership) : null
    res.json({ kind: token.kind, existing: Boolean(account), email: token.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2'), company: p?.company, packageName: p?.packageName })
})
router.post('/link/confirmar', authLimit, async (req, res) => {
    const token = await findToken(req.body.token)
    if (!token) return res.status(410).json({ erro: 'Este link expirou ou já foi utilizado.' })
    if (!process.env.JWT_SECRET) return res.status(503).json({ erro: 'Acesso temporariamente indisponível.' })
    if (token.kind !== 'invite') {
        if (!validPassword(req.body.password)) return res.status(400).json({ erro: 'Use uma senha de pelo menos 8 caracteres (até 72 bytes).' })
        const consumed = await Token.findOneAndDelete({ _id: token._id, environment: payments.environment(), expires: { $gt: new Date() } })
        if (!consumed) return res.status(410).json({ erro: 'Este link já foi utilizado.' })
        const result = await Account.updateOne({ _id: token.account, email: token.email, environment: payments.environment(), active: true }, { $set: { password: await bcrypt.hash(req.body.password, 10), failedLogins: 0, lockedAt: null }, $inc: { sessionVersion: 1 } })
        if (!result.matchedCount) return res.status(410).json({ erro: 'Acesso indisponível. Solicite um novo link.' })
        return res.json({ msg: 'Senha atualizada e acesso desbloqueado. Entre novamente.' })
    }
    const p = await Partnership.findOne({ _id: token.partnership, email: token.email, accepted: { $ne: null }, portalVersion: 1 })
    if (!p) return res.status(410).json({ erro: 'A proposta não está disponível.' })
    await payments.requireReceived(p)
    let account = await Account.findOne({ email: token.email, environment: payments.environment() }).select('+sessionVersion')
    if (account) {
        let current
        await partnerAuth(req, { status(code) { this.code = code; return this }, json() {} }, () => { current = req.partner })
        if (!current || String(current._id) !== String(account._id)) return res.status(409).json({ erro: 'Entre com sua conta de parceiro para vincular esta campanha.', existing: true })
    } else {
        if (!validPassword(req.body.password)) return res.status(400).json({ erro: 'Crie uma senha de pelo menos 8 caracteres (até 72 bytes).' })
        if (req.body.policyAccepted !== true) return res.status(400).json({ erro: 'Confirme o uso dos dados para administrar suas parcerias.' })
    }
    if (p.partnerAccount && String(p.partnerAccount) !== String(account?._id)) return res.status(409).json({ erro: 'A campanha já está vinculada a outra conta.' })
    const consumed = await Token.findOneAndDelete({ _id: token._id, environment: payments.environment(), expires: { $gt: new Date() } })
    if (!consumed) return res.status(410).json({ erro: 'Este link já foi utilizado.' })
    if (!account) account = await Account.create({ email: token.email, name: p.representative || p.company, password: await bcrypt.hash(req.body.password, 10), environment: payments.environment(), verifiedAt: new Date(), sessionVersion: 0, policyVersion: '2026-11-18', policyAcceptedAt: new Date() })
    const bound = await Partnership.updateOne({ _id: p._id, email: token.email, $or: [{ partnerAccount: null }, { partnerAccount: account._id }] }, { $set: { partnerAccount: account._id } })
    if (!bound.matchedCount) return res.status(409).json({ erro: 'Não foi possível vincular a campanha. Solicite outro link.' })
    res.json(session(account))
})

router.use(partnerAuth)
router.get('/conta', (req, res) => res.json(accountView(req.partner)))
router.post('/sair', async (req, res) => { await Account.updateOne({ _id: req.partner._id }, { $inc: { sessionVersion: 1 } }); res.sendStatus(204) })
router.put('/conta', async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    if (!name || name.length > 160) return res.status(400).json({ erro: 'Informe seu nome, com até 160 caracteres.' })
    await Account.updateOne({ _id: req.partner._id }, { $set: { name } })
    res.json({ ...accountView(req.partner), name })
})
router.post('/conta/senha', authLimit, async (req, res) => {
    if (!validPassword(req.body.password) || typeof req.body.currentPassword !== 'string' || Buffer.byteLength(req.body.currentPassword) > 72) return res.status(400).json({ erro: 'Confira as senhas. A nova deve ter pelo menos 8 caracteres.' })
    const account = await Account.findById(req.partner._id).select('+password')
    if (!account || !await bcrypt.compare(req.body.currentPassword, account.password)) return res.status(400).json({ erro: 'Senha atual incorreta.' })
    await Account.updateOne({ _id: account._id }, { $set: { password: await bcrypt.hash(req.body.password, 10) }, $inc: { sessionVersion: 1 } })
    res.json({ msg: 'Senha alterada. Entre novamente.' })
})
function campaignView(p) {
    return { id: p._id, company: p.company, packageName: p.packageName, cents: p.cents, cities: p.cities, positions: p.positions,
        durationDays: p.durationDays, requirements: p.requirements, assets: p.assets, revision: p.revision || 0, reviewState: p.reviewState || 'draft',
        reviewFeedback: p.reviewFeedback, campaignStart: p.campaignStart, campaignEnd: p.campaignEnd, publishedAt: p.publishedAt,
        paymentStatus: p.paymentStatus, paymentUrl: p.paymentUrl, due: p.due, destination: p.destination || '',
        portalPaused: p.portalPaused, renewalRequestedAt: p.renewalRequestedAt, createdAt: p.createdAt }
}
router.get('/campanhas', async (req, res) => {
    const query = { partnerAccount: req.partner._id }
    if (req.query.state === 'pending') query.reviewState = 'pending'
    else if (req.query.state === 'active') { query.publishedRevision = { $exists: true }; query.campaignEnd = { $gt: new Date() } }
    else if (req.query.state === 'ended') query.campaignEnd = { $lte: new Date() }
    else if (req.query.state && req.query.state !== 'all') return res.status(400).json({ erro: 'Filtro inválido.' })
    if (req.query.before) {
        if (!validId(req.query.before)) return res.status(400).json({ erro: 'Página inválida.' })
        query._id = { $lt: req.query.before }
    }
    const rows = await Partnership.find(query).sort({ _id: -1 }).limit(11).lean()
    res.json({ items: rows.slice(0, 10).map(campaignView), next: rows.length > 10 ? String(rows[9]._id) : null })
})
async function ownCampaign(req, res, next) {
    if (!validId(req.params.id)) return res.status(404).json({ erro: 'Campanha não encontrada.' })
    const p = await Partnership.findOne({ _id: req.params.id, partnerAccount: req.partner._id })
    if (!p) return res.status(404).json({ erro: 'Campanha não encontrada.' })
    req.campaign = p
    next()
}
router.use('/campanhas/:id', ownCampaign)
router.get('/campanhas/:id', (req, res) => res.json(campaignView(req.campaign)))
router.post('/campanhas/:id/pagamento', async (req, res) => {
    if (req.campaign.paymentId) await payments.refresh(req.campaign, await payments.asaas('/payments/' + encodeURIComponent(req.campaign.paymentId)))
    res.json(campaignView(req.campaign))
})
router.post('/campanhas/:id/artes/:key', async (req, res) => {
    const p = req.campaign
    if (p.campaignEnd && p.campaignEnd <= new Date()) return res.status(409).json({ erro: 'O período contratado encerrou. Solicite a renovação para enviar novas artes.' })
    const requirement = p.requirements.find(r => r.key === req.params.key)
    const revision = Number(req.query.revision)
    if (!requirement || !Number.isInteger(revision) || revision !== (p.revision || 0)) return res.status(409).json({ erro: 'O formato ou a campanha mudou. Atualize antes de enviar.' })
    if (p.reviewState === 'pending' || p.portalPaused) return res.status(409).json({ erro: 'Aguarde a revisão ou liberação desta campanha.' })
    if (p.paymentStatus !== 'RECEIVED') return res.status(409).json({ erro: 'O envio das artes exige pagamento recebido.' })
    if (!p.paymentVerifiedAt || Date.now() - +new Date(p.paymentVerifiedAt) > 300000) await payments.requireReceived(p)
    const lease = new Date(Date.now() + 60000)
    const claim = await Partnership.updateOne({ _id: p._id, partnerAccount: req.partner._id, revision, reviewState: { $ne: 'pending' }, $or: [{ mediaLockUntil: null }, { mediaLockUntil: { $lt: new Date() } }] }, { $set: { mediaLockUntil: lease } })
    if (!claim.modifiedCount) return res.status(409).json({ erro: 'Há outro envio em andamento. Aguarde e atualize.' })
    let stored, thumbnail, saved = false
    try {
        await new Promise((resolve, reject) => upload(req, res, error => error ? reject(Object.assign(error, { status: 400 })) : resolve()))
        if (!req.file) return res.status(400).json({ erro: 'Escolha o arquivo da arte.' })
        const metadata = await media.inspect(req.file, requirement)
        stored = await r2.uploadArquivoR2(req.file, { pasta: 'parceiros', prefixo: 'arte' })
        if (metadata.thumbnail) {
            thumbnail = await r2.uploadArquivoR2({ originalname: 'miniatura.webp', mimetype: 'image/webp', buffer: metadata.thumbnail }, { pasta: 'parceiros', prefixo: 'miniatura' })
            delete metadata.thumbnail
        }
        const asset = { key: requirement.key, url: stored.url, storageKey: stored.key, thumbnailUrl: thumbnail?.url, thumbnailKey: thumbnail?.key, ...metadata, bytes: req.file.buffer.length }
        const old = p.assets.find(a => a.key === requirement.key)
        const assets = p.assets.filter(a => a.key !== requirement.key).map(a => a.toObject ? a.toObject() : a)
        assets.push(asset)
        const result = await Partnership.updateOne({ _id: p._id, revision, mediaLockUntil: lease, paymentStatus: 'RECEIVED' }, { $set: { assets, reviewState: 'draft', reviewFeedback: '' }, $inc: { revision: 1 }, $unset: { approvalHash: 1, approvalExpires: 1 } })
        if (!result.modifiedCount) throw Object.assign(new Error('A campanha mudou durante o envio. Atualize e tente novamente.'), { status: 409 })
        saved = true
        if (old?.storageKey) await media.cleanupDraft(p, old)
        res.json({ asset, revision: revision + 1 })
    } finally {
        if (stored && !saved) { try { await r2.deletePartnerAsset(stored.key) } catch (error) { console.error('Limpeza de envio incompleto:', error.name) } }
        if (thumbnail && !saved) { try { await r2.deletePartnerAsset(thumbnail.key) } catch (error) { console.error('Limpeza de miniatura:', error.name) } }
        await Partnership.updateOne({ _id: p._id, mediaLockUntil: lease }, { $unset: { mediaLockUntil: 1 } })
    }
})
router.post('/campanhas/:id/revisao', async (req, res) => {
    const p = req.campaign, revision = Number(req.body.revision)
    if (p.campaignEnd && p.campaignEnd <= new Date()) return res.status(409).json({ erro: 'O período contratado encerrou. Solicite a renovação.' })
    if (revision !== (p.revision || 0) || !Number.isInteger(revision) || p.reviewState === 'pending' || p.portalPaused || p.mediaLockUntil > new Date()) return res.status(409).json({ erro: 'A campanha mudou ou já está em revisão. Atualize.' })
    if (!p.requirements.length || !p.requirements.every(r => p.assets.some(a => a.key === r.key))) return res.status(400).json({ erro: 'Envie uma arte para cada formato contratado.' })
    const destination = typeof req.body.destination === 'string' ? req.body.destination.trim() : ''
    if (destination && !webURL(destination)) return res.status(400).json({ erro: 'Informe um link HTTPS válido, sem usuário ou senha na URL, ou deixe em branco.' })
    await payments.requireReceived(p)
    const result = await Partnership.updateOne({ _id: p._id, revision, reviewState: { $ne: 'pending' }, $or: [{ mediaLockUntil: null }, { mediaLockUntil: { $lte: new Date() } }] }, { $set: { destination, reviewState: 'pending', submittedAt: new Date(), reviewFeedback: '' }, $inc: { revision: 1 }, $unset: { approvalHash: 1, approvalExpires: 1 } })
    if (!result.modifiedCount) return res.status(409).json({ erro: 'A campanha mudou. Atualize antes de continuar.' })
    res.json({ msg: 'Artes enviadas para revisão. Você acompanhará a resposta aqui.' })
})
router.post('/campanhas/:id/renovacao', async (req, res) => {
    if (!['keep', 'new'].includes(req.body.art)) return res.status(400).json({ erro: 'Escolha manter as artes ou enviar novas.' })
    if (!req.campaign.campaignEnd) return res.status(409).json({ erro: 'A campanha ainda não foi publicada.' })
    const result = await Partnership.updateOne({ _id: req.campaign._id, renewalRequestedAt: null }, { $set: { renewalRequestedAt: new Date(), renewalArt: req.body.art } })
    res.json({ msg: result.modifiedCount ? 'Pedido de renovação registrado. A equipe enviará a próxima proposta; nenhuma cobrança foi criada automaticamente.' : 'Seu pedido de renovação já está registrado.' })
})
router.use((error, req, res, next) => {
    console.error('Portal do parceiro:', error.name)
    res.status(error.status || 503).json({ erro: error.code === 'LIMIT_FILE_SIZE' ? 'O arquivo deve ter até 4 MB.' : error.name === 'MulterError' ? 'Envie somente um arquivo de arte por vez.' : error.status ? error.message : 'Não foi possível concluir. Tente novamente.' })
})
module.exports = router
