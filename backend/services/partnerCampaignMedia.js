const multer = require('multer')
const Partnership = require('../models/CommercialPartnership')
const media = require('./partnerMedia')
const r2 = require('../config/r2')
const { webURL } = require('./partnerRules')
const { requireEntitlement, fundingMatch } = require('./partnerFunding')
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }).single('file')
async function uploadArt(req, res) {
    const p = req.campaign
    if (p.campaignEnd && p.campaignEnd <= new Date()) return res.status(409).json({ erro: 'O período contratado encerrou. Solicite a renovação para enviar novas artes.' })
    const requirement = p.requirements.find(r => r.key === req.params.key)
    const revision = Number(req.query.revision)
    if (!requirement || !Number.isInteger(revision) || revision !== (p.revision || 0)) return res.status(409).json({ erro: 'O formato ou a campanha mudou. Atualize antes de enviar.' })
    if (p.reviewState === 'pending' || p.portalPaused) return res.status(409).json({ erro: 'Aguarde a revisão ou liberação desta campanha.' })
    await requireEntitlement(p)
    const lease = new Date(Date.now() + 60000)
    const claim = await Partnership.updateOne({ _id: p._id, ...fundingMatch(p), revision, portalPaused: { $ne: true }, reviewState: { $ne: 'pending' }, $or: [{ mediaLockUntil: null }, { mediaLockUntil: { $lt: new Date() } }] }, { $set: { mediaLockUntil: lease } })
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
        const result = await Partnership.updateOne({ _id: p._id, revision, mediaLockUntil: lease, ...fundingMatch(p), portalPaused: { $ne: true } }, { $set: { assets, reviewState: 'draft', reviewFeedback: '' }, $inc: { revision: 1 }, $unset: { approvalHash: 1, approvalExpires: 1 } })
        if (!result.modifiedCount) throw Object.assign(new Error('A campanha mudou durante o envio. Atualize e tente novamente.'), { status: 409 })
        saved = true
        if (old?.storageKey) await media.cleanupDraft(p, old)
        res.json({ asset, revision: revision + 1 })
    } finally {
        if (stored && !saved) { try { await r2.deletePartnerAsset(stored.key) } catch (error) { console.error('Limpeza de envio incompleto:', error.name) } }
        if (thumbnail && !saved) { try { await r2.deletePartnerAsset(thumbnail.key) } catch (error) { console.error('Limpeza de miniatura:', error.name) } }
        await Partnership.updateOne({ _id: p._id, mediaLockUntil: lease }, { $unset: { mediaLockUntil: 1 } })
    }
}
async function submitReview(req, res) {
    const p = req.campaign, revision = Number(req.body.revision)
    if (p.campaignEnd && p.campaignEnd <= new Date()) return res.status(409).json({ erro: 'O período contratado encerrou. Solicite a renovação.' })
    if (revision !== (p.revision || 0) || !Number.isInteger(revision) || p.reviewState === 'pending' || p.portalPaused || p.mediaLockUntil > new Date()) return res.status(409).json({ erro: 'A campanha mudou ou já está em revisão. Atualize.' })
    if (!p.requirements.length || !p.requirements.every(r => p.assets.some(a => a.key === r.key))) return res.status(400).json({ erro: 'Envie uma arte para cada formato contratado.' })
    const destination = typeof req.body.destination === 'string' ? req.body.destination.trim() : ''
    if (destination && !webURL(destination)) return res.status(400).json({ erro: 'Informe um link HTTPS válido, sem usuário ou senha na URL, ou deixe em branco.' })
    await requireEntitlement(p)
    const result = await Partnership.updateOne({ _id: p._id, revision, ...fundingMatch(p), portalPaused: { $ne: true }, reviewState: { $ne: 'pending' }, $or: [{ mediaLockUntil: null }, { mediaLockUntil: { $lte: new Date() } }] }, { $set: { destination, reviewState: 'pending', submittedAt: new Date(), reviewFeedback: '' }, $inc: { revision: 1 }, $unset: { approvalHash: 1, approvalExpires: 1 } })
    if (!result.modifiedCount) return res.status(409).json({ erro: 'A campanha mudou. Atualize antes de continuar.' })
    res.json({ msg: 'Artes enviadas para revisão. Você acompanhará a resposta aqui.' })
}
module.exports = { uploadArt, submitReview }
