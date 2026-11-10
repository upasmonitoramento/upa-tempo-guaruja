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
