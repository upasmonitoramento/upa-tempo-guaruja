const express = require('express')
const { randomBytes, createHash } = require('node:crypto')
const auth = require('../middlewares/auth')
const role = require('../middlewares/role')
const Partnership = require('../models/CommercialPartnership')
const Sponsor = require('../models/Patrocinador')
const Ad = require('../models/Anuncio')
const Area = require('../models/AreaAds')
const Log = require('../models/Log')
const { requireReceived, production, webhookToken } = require('../services/commercialPayments')
const { slug, positionMap, publicationPeriod, webURL } = require('../services/partnerRules')
const access = require('../services/partnerAccess')
const router = express.Router()
const idValid = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const digest = value => createHash('sha256').update(value).digest('hex')
router.use(auth, role('admin'), (req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
router.get('/revisoes', async (req, res) => {
    const state = ['pending', 'changes', 'approved', 'renewal'].includes(req.query.state) ? req.query.state : 'pending'
    const query = state === 'renewal' ? { renewalRequestedAt: { $ne: null } } : { reviewState: state, partnerAccount: { $ne: null } }
    if (req.query.before) {
        if (!idValid(req.query.before)) return res.status(400).json({ erro: 'Página inválida.' })
        query._id = { $lt: req.query.before }
    }
    const rows = await Partnership.find(query).select('company email packageName cents cities positions durationDays assets revision reviewState submittedAt campaignStart campaignEnd portalPaused paymentStatus renewalRequestedAt renewalArt').sort({ _id: -1 }).limit(21).lean()
    res.json({ items: rows.slice(0, 20), next: rows.length > 20 ? String(rows[19]._id) : null })
})
router.use('/campanhas/:id', async (req, res, next) => {
    if (!idValid(req.params.id)) return res.status(404).json({ erro: 'Campanha não encontrada.' })
    const p = await Partnership.findById(req.params.id)
    if (!p) return res.status(404).json({ erro: 'Campanha não encontrada.' })
    req.campaign = p
    next()
})
router.get('/campanhas/:id', (req, res) => {
    const p = req.campaign.toObject()
    for (const key of ['tokenHash', 'document', 'customerId', 'paymentAttempt', 'approvalHash']) delete p[key]
    res.json(p)
})
router.post('/campanhas/:id/convite', async (req, res) => {
    await requireReceived(req.campaign)
    await access.sendInvite(req.campaign, true)
    res.json({ msg: 'Convite enviado ao email da proposta. O parceiro validará o endereço antes de criar sua senha.' })
})
router.post('/campanhas/:id/ajustes', async (req, res) => {
    const feedback = typeof req.body.feedback === 'string' ? req.body.feedback.trim() : ''
    if (feedback.length < 3 || feedback.length > 500 || !Number.isInteger(req.body.revision)) return res.status(400).json({ erro: 'Descreva o ajuste necessário, com até 500 caracteres.' })
    const result = await Partnership.updateOne({ _id: req.campaign._id, revision: req.body.revision, reviewState: 'pending' }, { $set: { reviewState: 'changes', reviewFeedback: feedback }, $inc: { revision: 1 }, $unset: { approvalHash: 1, approvalExpires: 1 } })
    if (!result.modifiedCount) return res.status(409).json({ erro: 'A revisão mudou. Atualize a ficha.' })
    res.json({ msg: 'Solicitação de ajuste registrada no portal do parceiro.' })
})
async function reviewable(p) {
    if (production() && (process.env.PORTAL_COMERCIAL_PRODUCAO !== '1' || !webhookToken())) throw Object.assign(new Error('Conclua a integração real de pagamentos e webhook antes de publicar campanhas pagas.'), { status: 503 })
    if (p.portalVersion !== 1 || !p.partnerAccount || p.reviewState !== 'pending' || p.portalPaused || ![14, 28].includes(p.durationDays) || !p.requirements.length || !p.requirements.every(r => p.assets.some(a => a.key === r.key)) || p.destination && !webURL(p.destination)) {
        throw Object.assign(new Error('A campanha ainda não está pronta para aprovação.'), { status: 409 })
    }
    if (p.campaignEnd && p.campaignEnd <= new Date()) throw Object.assign(new Error('O período contratado encerrou. É necessária uma nova parceria paga para renovar.'), { status: 409 })
    if (!p.cities?.length || p.cities.some(c => slug(c) !== 'guaruja')) throw Object.assign(new Error('Por enquanto, somente Guarujá está disponível para publicação. Ajuste a proposta antes de aprovar.'), { status: 409 })
    await requireReceived(p)
    const codes = [...new Set(p.requirements.flatMap(r => r.codes))]
    const areas = await Area.find({ codigo: { $in: codes }, status: 'ativo' }).lean()
    if (!codes.length || !p.requirements.every(r => r.codes.every(code => areas.some(a => a.codigo === code && a.larguraPx === r.width && a.alturaPx === r.height && a.posicao === positionMap[r.position])))) throw Object.assign(new Error('Os espaços ou tamanhos foram alterados. Confira a configuração antes de aprovar.'), { status: 409 })
}
const periodFor = p => p.campaignStart && p.campaignEnd ? { start: p.campaignStart, end: p.campaignEnd } : publicationPeriod(p.durationDays)
router.post('/campanhas/:id/preparar-aprovacao', async (req, res) => {
    const p = req.campaign
    if (req.body.revision !== p.revision) return res.status(409).json({ erro: 'A revisão mudou. Atualize a ficha.' })
    await reviewable(p)
    const token = randomBytes(32).toString('hex')
    const period = periodFor(p)
    const result = await Partnership.updateOne({ _id: p._id, revision: p.revision, reviewState: 'pending', paymentStatus: 'RECEIVED' }, { $set: { approvalHash: digest(token), approvalAdmin: req.user.id, approvalExpires: new Date(Date.now() + 5 * 60000), approvalStart: period.start, approvalEnd: period.end } })
    if (!result.modifiedCount) return res.status(409).json({ erro: 'A campanha mudou durante a conferência.' })
    res.json({ token, start: period.start, end: period.end, cents: p.cents, company: p.company, packageName: p.packageName, cities: p.cities, formats: p.requirements.length, paymentStatus: p.paymentStatus })
})
router.post('/campanhas/:id/aprovar', async (req, res) => {
    const p = req.campaign
    if (req.body.confirmed !== true || req.body.revision !== p.revision || !/^[a-f\d]{64}$/.test(req.body.token || '')) return res.status(400).json({ erro: 'Confirme a revisão e o recebimento antes de aprovar.' })
    await reviewable(p)
    const claimed = await Partnership.findOneAndUpdate({ _id: p._id, revision: p.revision, reviewState: 'pending', approvalHash: digest(req.body.token), approvalAdmin: req.user.id, approvalExpires: { $gt: new Date() } }, { $unset: { approvalHash: 1, approvalExpires: 1 } })
    if (!claimed) return res.status(409).json({ erro: 'A confirmação expirou ou já foi utilizada. Confira novamente.' })
    const expected = periodFor(p)
    if (+new Date(claimed.approvalStart) !== +expected.start || +new Date(claimed.approvalEnd) !== +expected.end) return res.status(409).json({ erro: 'O calendário mudou. Confira as novas datas e confirme novamente.' })
    const period = { start: claimed.approvalStart, end: claimed.approvalEnd }
    const sponsor = await Sponsor.findOneAndUpdate({ partnerIdentity: digest(String(p.partnerAccount) + '|' + p.document + '|' + slug(p.company)) }, { $setOnInsert: {
        partnerAccount: p.partnerAccount, responsavelNome: p.representative || p.company, documentoResponsavel: p.document,
        tipoDocumentoResponsavel: p.document?.length === 11 ? 'cpf' : 'cnpj', email: p.email, empresaNome: p.company, status: 'ativo'
    } }, { upsert: true, returnDocument: 'after', runValidators: true })
    if (sponsor.status !== 'ativo') return res.status(409).json({ erro: 'O cadastro da empresa está inativo. Revise antes de publicar.' })
    for (const requirement of p.requirements) {
        const asset = p.assets.find(a => a.key === requirement.key)
        const ad = await Ad.findOneAndUpdate({ partnership: p._id, publicationRevision: p.revision, slot: requirement.key }, { $set: {
            patrocinador: sponsor._id, nome: p.company + ' · ' + requirement.label,
            posicao: positionMap[requirement.position], tipoMidia: asset.type, midia: asset.url,
            storageKey: asset.storageKey, thumbnailKey: asset.thumbnailKey, linkDestino: p.destination,
            tempoExibicaoSegundos: asset.type === 'video' ? Math.max(6, Math.ceil(asset.duration)) : 6,
            dataInicio: period.start, dataFim: period.end, status: 'ativo', cities: p.cities.map(slug)
        } }, { upsert: true, returnDocument: 'after', runValidators: true })
        await Area.updateMany({ codigo: { $in: requirement.codes }, status: 'ativo' }, { $addToSet: { anunciosAtuais: ad._id } })
    }
    // Ads are invisible until this final release pointer changes; partial writes cannot publish.
    const release = await Partnership.updateOne({ _id: p._id, revision: p.revision, reviewState: 'pending', paymentStatus: 'RECEIVED', portalPaused: { $ne: true } }, { $set: { reviewState: 'approved', publishedRevision: p.revision, publishedAt: new Date(), campaignStart: period.start, campaignEnd: period.end, reviewFeedback: '' } })
    if (!release.modifiedCount) return res.status(409).json({ erro: 'A campanha mudou e não foi liberada. Atualize a ficha.' })
    const old = await Ad.find({ partnership: p._id, publicationRevision: { $ne: p.revision } }).select('_id').lean()
    if (old.length) {
        const ids = old.map(a => a._id)
        await Area.updateMany({ anunciosAtuais: { $in: ids } }, { $pull: { anunciosAtuais: { $in: ids } } })
        await Area.updateMany({ anuncioAtual: { $in: ids } }, { $set: { anuncioAtual: null } })
        await Ad.updateMany({ _id: { $in: ids } }, { $set: { status: 'expirado' } })
    }
    await Log.create({ usuarioId: req.user.id, usuarioNome: 'Administrador', acao: 'APROVACAO_CAMPANHA', alvo: p.company, detalhes: `Revisão ${p.revision}; ${p.durationDays} dias; pagamento recebido e conferido no Asaas.` })
    res.json({ msg: 'Campanha aprovada e programada.', start: period.start, end: period.end })
})
router.use((error, req, res, next) => {
    console.error('Revisão de parceiros:', error.name)
    res.status(error.status || 503).json({ erro: error.status ? error.message : 'Não foi possível concluir a revisão. Atualize e tente novamente.' })
})
module.exports = router
