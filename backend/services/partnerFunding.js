// Courtesy is an explicit administrative grant, never a synthetic payment.
const validCourtesy = p => p?.fundingType === 'courtesy' && Boolean(p.courtesySponsor && p.courtesyGrantedBy && p.courtesyGrantedAt) && !p.courtesyRevokedAt && p.cents === 0 && !p.paymentId
const entitled = p => p?.fundingType === 'courtesy' ? validCourtesy(p) : (!p?.fundingType || p.fundingType === 'paid') && p?.paymentStatus === 'RECEIVED'
function fundingMatch(p) {
    return p.fundingType === 'courtesy'
        ? { fundingType: 'courtesy', courtesySponsor: p.courtesySponsor, courtesyGrantedBy: p.courtesyGrantedBy, courtesyGrantedAt: p.courtesyGrantedAt, courtesyRevokedAt: null, cents: 0, paymentId: null }
        : { fundingType: { $ne: 'courtesy' }, paymentStatus: 'RECEIVED' }
}
async function requireEntitlement(p) {
    if (p.fundingType === 'courtesy') {
        if (!validCourtesy(p)) throw Object.assign(new Error('A cortesia não está autorizada ou foi encerrada.'), { status: 409 })
        return p
    }
    if (p.fundingType && p.fundingType !== 'paid') throw Object.assign(new Error('Modalidade de campanha inválida.'), { status: 409 })
    return require('./commercialPayments').requireReceived(p)
}
module.exports = { validCourtesy, entitled, fundingMatch, requireEntitlement }
