const express = require("express")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto")
const User = require("../models/User")

const router = express.Router()
const Partnership = mongoose.model("CommercialPartnership", new mongoose.Schema({
    company: String, email: String, packageName: String, cities: [String],
    positions: [String], start: String, end: String, due: String, cents: Number,
    terms: String, expires: Date, tokenHash: String,
    accepted: Date, representative: String, document: String,
    customerId: String, paymentId: String, paymentUrl: String,
    paymentStatus: String, paymentAttempt: Date
}, { timestamps: true }))
const digest = value => createHash("sha256").update(value).digest("hex")
const text = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : ""
const terms = "Piloto do Conecta Saúde. A proposta informa o valor, o período e onde a campanha será exibida. A exibição depende do aceite, da confirmação do Pix e da aprovação da arte."
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())
const positions = ["card", "detalhe", "rodape", "banner"]
const adminView = "-tokenHash -document -customerId"
const production = () => process.env.VERCEL_ENV === "production"
const apiKey = () => production() ? process.env.ASAAS_API_KEY : process.env.ASAAS_SANDBOX_API_KEY
const webhookToken = () => production() ? process.env.ASAAS_WEBHOOK_TOKEN : process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store")
    const enabled = production()
        ? process.env.PORTAL_COMERCIAL_PRODUCAO === "1" && apiKey() && webhookToken()
        : process.env.PORTAL_COMERCIAL_TESTE === "1"
    // Administrators can inspect the dashboard before live billing is enabled.
    const preparation = production() && !enabled && req.method === "GET" && req.path === "/painel"
    if (!enabled && !preparation) return res.sendStatus(404)
    res.set("X-Portal-Commercial-Mode", preparation ? "preparation" : production() ? "production" : "sandbox")
    next()
})

async function requireAdmin(req, res, next) {
    if (!process.env.JWT_SECRET) return res.sendStatus(503)
    let session
    try {
        session = jwt.verify(req.get("Authorization"), process.env.JWT_SECRET, { algorithms: ["HS256"] })
    } catch {
        return res.sendStatus(401)
    }
    if (!mongoose.isObjectIdOrHexString(session.id)) return res.sendStatus(401)
    const user = await User.findById(session.id).select("tipo status")
    if (user?.tipo !== "admin" || user.status !== "ativo") return res.sendStatus(403)
    next()
}

async function asaas(path, method = "GET", body) {
    if (!apiKey()) throw Object.assign(new Error("Configure a chave do Asaas."), { status: 503 })
    const base = production() ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"
    const response = await fetch(base + path, {
        method, redirect: "error", signal: AbortSignal.timeout(7000),
        headers: { access_token: apiKey(), "Content-Type": "application/json", "User-Agent": "PortalSaude/1.0" },
        body: body ? JSON.stringify(body) : undefined
    })
    if (!response.ok) throw Object.assign(new Error("O Asaas recusou a operação. Confira a configuração e os dados."), { status: 502 })
    return response.json()
}

async function refresh(partnership, payment) {
    if (!payment || payment.externalReference !== String(partnership.id) ||
        payment.customer !== partnership.customerId || payment.billingType !== "PIX" ||
        Math.round(Number(payment.value) * 100) !== partnership.cents) {
        throw Object.assign(new Error("A cobrança retornada não corresponde à proposta."), { status: 409 })
    }
    const invoice = payment.invoiceUrl ? new URL(payment.invoiceUrl) : null
    const hosts = production() ? ["asaas.com", "www.asaas.com"] : ["sandbox.asaas.com"]
    await Partnership.updateOne({ _id: partnership.id }, { $set: {
        paymentId: payment.id,
        paymentStatus: payment.status,
        paymentUrl: invoice?.protocol === "https:" && hosts.includes(invoice.hostname) ? invoice.href : undefined
    } })
}

router.get("/painel", requireAdmin, async (req, res) => {
    res.json(await Partnership.find().select(adminView).sort({ createdAt: -1 }).limit(100).lean())
})

router.post("/propostas", requireAdmin, async (req, res) => {
    const { start, end, due, cents } = req.body
    const company = text(req.body.company, 160)
    const email = text(req.body.email, 160).toLowerCase()
    const packageName = text(req.body.packageName, 80)
    const cities = Array.isArray(req.body.cities) ? [...new Set(req.body.cities.map(city => text(city, 80)).filter(Boolean))] : []
    const slots = Array.isArray(req.body.positions) ? [...new Set(req.body.positions)] : []
    if (!company || !packageName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !cities.length || cities.length > 3 || !slots.length || !slots.every(slot => positions.includes(slot)) ||
        ![start, end, due].every(validDate) || start > end || due < today() || !Number.isSafeInteger(cents) || cents < 500 || cents > 10000000) {
        return res.status(400).json({ erro: "Confira o contato, valor, datas, cidades e posições da proposta." })
    }
    const token = randomBytes(32).toString("hex")
    await Partnership.create({ company, email, packageName, cities, positions: slots, start, end, due, cents,
        terms: production() ? terms.replace("Piloto do Conecta Saúde.", "Proposta de publicidade do Conecta Saúde.") : terms,
        expires: new Date(Date.now() + 7 * 86400000), tokenHash: digest(token) })
    res.status(201).json({ path: "/proposta.html#" + token })
})

router.get("/aceite/:token", async (req, res) => {
    const p = await Partnership.findOne({ tokenHash: digest(req.params.token), expires: { $gt: new Date() } })
        .select("company packageName cities positions start end due cents terms accepted")
    if (!p) return res.sendStatus(404)
    res.json(p)
})

router.post("/aceite/:token", async (req, res) => {
    const email = text(req.body.email, 160).toLowerCase()
    const representative = text(req.body.representative, 160)
    const document = text(req.body.document, 25).toUpperCase().replace(/[.\-/\s]/g, "")
    if (!representative || !/^(?:\d{11}|[A-Z0-9]{12}\d{2})$/.test(document) || req.body.accepted !== true) {
        return res.status(400).json({ erro: "Informe o representante, CPF ou CNPJ e confirme o aceite." })
    }
    const result = await Partnership.updateOne({
        tokenHash: digest(req.params.token), email, expires: { $gt: new Date() }, accepted: null
    }, { $set: { accepted: new Date(), representative, document } })
    if (!result.modifiedCount) return res.status(409).json({ erro: "Confira o e-mail da proposta ou solicite um novo link." })
    res.json({ ok: true })
})

router.post("/propostas/:id/pix", requireAdmin, async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404)
    if (!apiKey()) return res.status(503).json({ erro: "Configure a chave do Asaas." })
    const p = await Partnership.findOne({ _id: req.params.id, accepted: { $ne: null } })
    if (!p) return res.status(409).json({ erro: "A proposta precisa ser aceita antes da cobrança." })
    if (p.paymentId) {
        await refresh(p, await asaas("/payments/" + encodeURIComponent(p.paymentId)))
        return res.json({ ok: true })
    }
    if (p.paymentAttempt) {
        const found = await asaas("/payments?externalReference=" + p.id + "&limit=2")
        if (found.data?.length !== 1) return res.status(409).json({ erro: "Confira a tentativa anterior no Asaas antes de emitir outra cobrança." })
        await refresh(p, found.data[0])
        return res.json({ ok: true })
    }
    if (p.due < today()) return res.status(409).json({ erro: "A data de vencimento já passou." })
    const attempt = new Date()
    const claimed = await Partnership.updateOne({ _id: p.id, paymentAttempt: null }, { $set: { paymentAttempt: attempt } })
    if (!claimed.modifiedCount) return res.sendStatus(409)
    if (!p.customerId) {
        try {
            const customer = await asaas("/customers", "POST", { name: p.company, cpfCnpj: p.document, notificationDisabled: true })
            p.customerId = customer.id
            await Partnership.updateOne({ _id: p.id }, { $set: { customerId: p.customerId } })
        } catch (error) {
            // No payment request has been sent, so retrying cannot create a second charge.
            await Partnership.updateOne({ _id: p.id, paymentAttempt: attempt }, { $unset: { paymentAttempt: 1 } })
            throw error
        }
    }
    const payment = await asaas("/payments", "POST", { customer: p.customerId, billingType: "PIX",
        value: p.cents / 100, dueDate: p.due, externalReference: String(p.id),
        description: production() ? "Conecta Saúde - publicidade" : "Conecta Saúde - cobrança de teste" })
    await refresh(p, payment)
    res.json({ ok: true })
})

router.post("/asaas/webhook", async (req, res) => {
    const expected = webhookToken()
    const token = req.get("asaas-access-token") || ""
    if (!expected || !timingSafeEqual(Buffer.from(digest(expected)), Buffer.from(digest(token)))) return res.sendStatus(401)
    const id = req.body.payment?.id
    if (typeof id !== "string" || !/^pay_[\w-]{1,90}$/.test(id)) return res.sendStatus(200)
    const p = await Partnership.findOne({ paymentId: id })
    if (p) await refresh(p, await asaas("/payments/" + encodeURIComponent(id)))
    res.sendStatus(200)
})

router.use((error, req, res, next) => {
    res.status(error.status || 500).json({ erro: error.status ? error.message : "Falha ao processar a operação comercial." })
})

module.exports = router
