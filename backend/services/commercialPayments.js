const Partnership = require('../models/CommercialPartnership')
const production = () => process.env.VERCEL_ENV === 'production'
const environment = () => production() ? 'production' : 'sandbox'
const apiKey = () => production() ? process.env.ASAAS_API_KEY : process.env.ASAAS_SANDBOX_API_KEY
const webhookToken = () => production() ? process.env.ASAAS_WEBHOOK_TOKEN : process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN
async function asaas(path, method = 'GET', body) {
    if (!apiKey()) throw Object.assign(new Error('Configure a chave do Asaas.'), { status: 503 })
    const base = production() ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
    const response = await fetch(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(7000),
        headers: { access_token: apiKey(), 'Content-Type': 'application/json', 'User-Agent': 'PortalSaude/1.0' },
        body: body ? JSON.stringify(body) : undefined })
    if (!response.ok) throw Object.assign(new Error('O Asaas recusou a operação. Confira a configuração e os dados.'), { status: 502 })
    return response.json()
}
async function refresh(partnership, payment) {
    if (partnership.fundingType === 'courtesy') throw Object.assign(new Error('Cortesia não possui cobrança.'), { status: 409 })
    if (!payment || (partnership.paymentId && payment.id !== partnership.paymentId) ||
        payment.externalReference !== String(partnership.id || partnership._id) || payment.customer !== partnership.customerId ||
        payment.billingType !== 'PIX' || Math.round(Number(payment.value) * 100) !== partnership.cents) {
        throw Object.assign(new Error('A cobrança retornada não corresponde à proposta.'), { status: 409 })
    }
    const invoice = payment.invoiceUrl ? new URL(payment.invoiceUrl) : null
    const hosts = production() ? ['asaas.com', 'www.asaas.com'] : ['sandbox.asaas.com']
    const values = { paymentId: payment.id, paymentStatus: payment.status, paymentVerifiedAt: new Date(),
        paymentUrl: invoice?.protocol === 'https:' && hosts.includes(invoice.hostname) ? invoice.href : undefined }
    if (payment.status === 'RECEIVED') values.paymentReceivedAt = partnership.paymentReceivedAt || new Date()
    await Partnership.updateOne({ _id: partnership.id || partnership._id }, { $set: values })
    Object.assign(partnership, values)
    return partnership
}
async function requireReceived(partnership) {
    if (!partnership.paymentId) throw Object.assign(new Error('O pagamento ainda não foi recebido.'), { status: 409 })
    await refresh(partnership, await asaas('/payments/' + encodeURIComponent(partnership.paymentId)))
    if (partnership.paymentStatus !== 'RECEIVED') throw Object.assign(new Error('O Asaas ainda não confirmou o valor disponível. Agendamento ou comprovante não liberam a campanha.'), { status: 409 })
    return partnership
}
module.exports = { production, environment, apiKey, webhookToken, asaas, refresh, requireReceived }
