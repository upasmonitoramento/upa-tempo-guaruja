const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const User = require('../models/User')
const Reset = require('../models/PasswordReset')
const email = require('../config/recoveryEmail')
const auth = require('../middlewares/auth')
const router = require('./auth')
const id = '692000000000000000000001'

test('sessões acompanham permissões, bloqueios, remoção e versão da senha', async t => {
    process.env.JWT_SECRET = 'only-for-auth-security-test'
    let user = { tipo: 'usuario', status: 'ativo', sessionVersion: 0 }
    t.mock.method(User, 'findById', () => ({ select: async () => user }))
    const token = jwt.sign({ id, tipo: 'admin' }, process.env.JWT_SECRET)
    async function check() {
        let status = 200, proceeded = false
        const req = { headers: { authorization: token } }
        const res = { status(code) { status = code; return this }, json() {} }
        await auth(req, res, () => { proceeded = true })
        return { status, proceeded, role: req.user?.tipo }
    }
    assert.equal((await check()).role, 'usuario', 'old admin claim must not grant access')
    for (const status of ['banido', 'removido', 'suspenso']) {
        user.status = status
        assert.equal((await check()).status, 403)
    }
    user = { tipo: 'admin', status: 'ativo', sessionVersion: 1 }
    assert.equal((await check()).status, 401)
    user = null
    assert.equal((await check()).status, 401)
})

test('CPF não redefine senha; código expira, só funciona uma vez e invalida sessões', async t => {
    const app = express(); app.use(express.json(), router)
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const base = `http://127.0.0.1:${server.address().port}`
    const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const user = { _id: id, tipo: 'admin', status: 'ativo', sessionVersion: 2, async save() {} }
    let stored = null, sentToken
    t.mock.method(email, 'configured', () => true)
    t.mock.method(email, 'sendRecovery', async (to, token) => { assert.equal(to, 'test@example.com'); sentToken = token })
    let accountExists = true
    t.mock.method(User, 'findOne', async () => accountExists ? user : null)
    t.mock.method(User, 'findById', () => ({ select: async () => user }))
    t.mock.method(Reset, 'findOneAndUpdate', async (query, update) => { stored = { _id: id, ...update.$set }; return stored })
    t.mock.method(Reset, 'findOneAndDelete', async query => {
        if (!stored || stored.tokenHash !== query.tokenHash || stored.expiresAt <= query.expiresAt.$gt) return null
        const row = stored; stored = null; return row
    })
    assert.equal((await post('/redefinir-senha', { email: 'test@example.com', cpf: '00000000000', novaSenha: 'new-password' })).status, 400)
    assert.equal(user.sessionVersion, 2)
    const known = await post('/solicitar-redefinicao', { email: 'test@example.com' })
    assert.equal(known.status, 200)
    accountExists = false
    const unknown = await post('/solicitar-redefinicao', { email: 'unknown@example.com' })
    assert.deepEqual(await unknown.json(), await known.json(), 'Email existence must not appear in the response')
    accountExists = true
    assert.equal(sentToken.length, 64)
    assert.notEqual(stored.tokenHash, sentToken)
    const valid = { ...stored }
    stored.expiresAt = new Date(0)
    assert.equal((await post('/redefinir-senha', { token: sentToken, novaSenha: 'new-password' })).status, 400)
    stored = valid
    assert.equal((await post('/redefinir-senha', { token: sentToken, novaSenha: 'new-password' })).status, 200)
    assert.equal(await bcrypt.compare('new-password', user.senha), true)
    assert.equal(user.sessionVersion, 3)
    assert.equal((await post('/redefinir-senha', { token: sentToken, novaSenha: 'new-password2' })).status, 400)
    email.configured = () => false
    assert.equal((await post('/solicitar-redefinicao', { email: 'test@example.com' })).status, 503)
})
