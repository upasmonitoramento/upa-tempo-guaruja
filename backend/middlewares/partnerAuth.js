const jwt = require('jsonwebtoken')
const Account = require('../models/PartnerAccount')
const { environment } = require('../services/commercialPayments')
module.exports = async (req, res, next) => {
    if (!process.env.JWT_SECRET) return res.status(503).json({ erro: 'Acesso temporariamente indisponível.' })
    let payload
    try {
        const token = String(req.get('Authorization') || '').replace(/^Bearer\s+/i, '')
        payload = jwt.verify(token, process.env.JWT_SECRET, { audience: 'conecta-partner', algorithms: ['HS256'] })
        if (!/^[a-f\d]{24}$/i.test(payload.sub) || payload.environment !== environment()) throw new Error('Invalid session')
    } catch { return res.status(401).json({ erro: 'Entre novamente no portal do parceiro.' }) }
    try {
        const account = await Account.findById(payload.sub).select('+sessionVersion')
        if (!account || account.environment !== environment() || !account.active || !account.verifiedAt || account.lockedAt || Number(account.sessionVersion || 0) !== payload.version) {
            return res.status(401).json({ erro: 'Acesso encerrado ou bloqueado. Entre novamente ou solicite um link por email.' })
        }
        req.partner = account
        next()
    } catch { res.status(503).json({ erro: 'Não foi possível validar seu acesso. Tente novamente.' }) }
}
