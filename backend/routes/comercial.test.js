const test = require("node:test")
const assert = require("node:assert/strict")
const express = require("express")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const router = require("./comercial")
const User = require("../models/User")

test("protege o piloto comercial e exige aceite antes de cobrar", async () => {
    const app = express()
    app.use(express.json(), router)
    const server = app.listen(0, "127.0.0.1")
    await new Promise(resolve => server.once("listening", resolve))
    const base = "http://127.0.0.1:" + server.address().port
    const originalUser = User.findById
    const model = mongoose.model("CommercialPartnership")
    const originalFind = model.findOne
    try {
        delete process.env.PORTAL_COMERCIAL_TESTE
        assert.equal((await fetch(base + "/painel")).status, 404)
        process.env.PORTAL_COMERCIAL_TESTE = "1"
        process.env.JWT_SECRET = "segredo-efemero-do-teste"
        process.env.ASAAS_SANDBOX_API_KEY = "chave-ficticia-sem-rede"
        assert.equal((await fetch(base + "/painel")).status, 401)
        const id = "692000000000000000000001"
        const headers = { Authorization: jwt.sign({ id, tipo: "admin" }, process.env.JWT_SECRET) }
        User.findById = () => ({ select: async () => ({ tipo: "funcionario", status: "ativo" }) })
        assert.equal((await fetch(base + "/painel", { headers })).status, 403)
        User.findById = () => ({ select: async () => ({ tipo: "admin", status: "ativo" }) })
        model.findOne = async filter => {
            assert.deepEqual(filter.accepted, { $ne: null })
            return null
        }
        const response = await fetch(base + "/propostas/" + id + "/pix", { method: "POST", headers })
        assert.equal(response.status, 409)
        assert.match((await response.json()).erro, /aceita/)
        assert.equal((await fetch(base + "/asaas/webhook", { method: "POST" })).status, 401)
    } finally {
        User.findById = originalUser
        model.findOne = originalFind
        await new Promise(resolve => server.close(resolve))
    }
})

test("proposta, aceite e Pix confirmado pelo provedor simulado", async t => {
    process.env.PORTAL_COMERCIAL_TESTE = "1"
    process.env.JWT_SECRET = "segredo-local-do-teste"
    process.env.ASAAS_SANDBOX_API_KEY = "chave-de-teste"
    process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN = "token-de-teste"
    const id = "692000000000000000000002"
    const model = mongoose.model("CommercialPartnership")
    let row
    let charges = 0
    let providerStatus = "PENDING"
    t.mock.method(User, "findById", () => ({ select: async () => ({ tipo: "admin", status: "ativo" }) }))
    t.mock.method(model, "create", async values => { row = { ...values, id } })
    t.mock.method(model, "findOne", filter => {
        if (filter.tokenHash) {
            return { select: async () => row?.tokenHash === filter.tokenHash ? { cents: row.cents, accepted: row.accepted } : null }
        }
        if (filter.paymentId) return row?.paymentId === filter.paymentId ? row : null
        return row?.id === filter._id && row.accepted ? row : null
    })
    t.mock.method(model, "updateOne", async (filter, update) => {
        if (filter.tokenHash && (filter.tokenHash !== row.tokenHash || filter.email !== row.email || row.accepted)) {
            return { modifiedCount: 0 }
        }
        if (filter.paymentAttempt === null && row.paymentAttempt) return { modifiedCount: 0 }
        Object.assign(row, update.$set)
        return { modifiedCount: 1 }
    })
    const payment = () => ({
        id: "pay_simulado", customer: "cus_simulado", externalReference: id,
        billingType: "PIX", value: 250, status: providerStatus,
        invoiceUrl: "https://sandbox.asaas.com/i/simulado"
    })
    const localFetch = fetch
    t.mock.method(global, "fetch", async (url, options) => {
        assert.equal(new URL(url).origin, "https://api-sandbox.asaas.com")
        if (url.endsWith("/customers")) return Response.json({ id: "cus_simulado" })
        if (url.endsWith("/payments") && options.method === "POST") {
            charges++
            assert.equal(JSON.parse(options.body).externalReference, id)
            return Response.json(payment())
        }
        assert.match(url, /\/payments\/pay_simulado$/)
        return Response.json(payment())
    })
    const app = express()
    app.use(express.json(), router)
    const server = app.listen(0, "127.0.0.1")
    await new Promise(resolve => server.once("listening", resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const url = "http://127.0.0.1:" + server.address().port
    const headers = { Authorization: jwt.sign({ id }, process.env.JWT_SECRET), "Content-Type": "application/json" }
    const post = (path, body, requestHeaders = headers) => localFetch(url + path, {
        method: "POST", headers: requestHeaders, body: JSON.stringify(body)
    })
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const created = await post("/propostas", { company: "Empresa fictícia", email: "teste@example.test",
        packageName: "Regional", cities: ["Guarujá"], positions: ["card"], start: date, end: date, due: date, cents: 25000 })
    assert.equal(created.status, 201)
    const token = (await created.json()).path.split("#")[1]
    const agreement = { email: "teste@example.test", representative: "Representante fictício", document: "00000000000", accepted: true }
    assert.equal((await post("/propostas/" + id + "/pix", {})).status, 409)
    assert.equal((await post("/aceite/" + token, { ...agreement, email: "outro@example.test" })).status, 409)
    assert.equal((await post("/aceite/" + token, agreement)).status, 200)
    assert.equal((await post("/aceite/" + token, agreement)).status, 409)
    assert.equal((await post("/propostas/" + id + "/pix", {})).status, 200)
    assert.equal(row.paymentStatus, "PENDING")
    const webhook = () => post("/asaas/webhook", { payment: { id: row.paymentId, status: "RECEIVED" } }, {
        "Content-Type": "application/json", "asaas-access-token": process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN
    })
    assert.equal((await webhook()).status, 200)
    assert.equal(row.paymentStatus, "PENDING")
    providerStatus = "RECEIVED"
    assert.equal((await webhook()).status, 200)
    assert.equal(row.paymentStatus, "RECEIVED")
    providerStatus = "REFUNDED"
    assert.equal((await webhook()).status, 200)
    assert.equal(row.paymentStatus, "REFUNDED")
    assert.equal((await post("/propostas/" + id + "/pix", {})).status, 200)
    assert.equal(charges, 1)
})
