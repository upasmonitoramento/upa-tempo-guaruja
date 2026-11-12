const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const router = require('./admin')
const ownerId = '6a1b0014d6afea9736eb1925'

test('proprietário não perde acesso e outro cadastro com mesmo email não herda proteção', async () => {
    const owner = new User({ _id: ownerId, tipo: 'usuario', status: 'removido', suspensoAte: new Date() })
    await owner.validate()
    assert.equal(owner.tipo, 'admin')
    assert.equal(owner.status, 'ativo')
    assert.equal(owner.suspensoAte, null)
    const other = new User({ email: 'ianeirmao11@gmail.com', tipo: 'funcionario', status: 'suspenso' })
    await other.validate()
    assert.equal(other.tipo, 'funcionario')
    assert.equal(other.status, 'suspenso')
})

test('API bloqueia alteração de permissão, suspensão, banimento e remoção do proprietário', async t => {
    process.env.JWT_SECRET = 'chave-efemera-apenas-teste-owner'
    const app = express()
    app.use(express.json(), router)
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const base = `http://127.0.0.1:${server.address().port}`
    // No database call should be made on any forbidden mutation.
    t.mock.method(User, 'findById', () => { throw new Error('Forbidden mutation reached database') })
    const admin = jwt.sign({ id: '692000000000000000000001', tipo: 'admin' }, process.env.JWT_SECRET)
    for (const [target, action] of [...['tipo', 'suspender', 'banir', 'remover', 'TIPO/'].map(action => [ownerId, action]), [ownerId.toUpperCase(), 'tipo']]) {
        const response = await fetch(`${base}/usuarios/${target}/${action}`, { method: 'PUT', headers: { Authorization: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'usuario', quantidade: 1, unidade: 'dias' }) })
        assert.equal(response.status, 403, action)
        assert.match((await response.json()).erro, /proprietária/)
    }
    const staff = jwt.sign({ id: '692000000000000000000001', tipo: 'funcionario' }, process.env.JWT_SECRET)
    assert.equal((await fetch(`${base}/usuarios/${ownerId}/remover`, { method: 'PUT', headers: { Authorization: staff } })).status, 403)
    assert.equal((await fetch(`${base}/usuarios/${ownerId}/remover`, { method: 'PUT' })).status, 401)
})

test('sessão válida do proprietário reconhece promoção sem manter o papel antigo do token', () => {
    const auth = require('../middlewares/auth')
    process.env.JWT_SECRET = 'chave-efemera-apenas-teste-owner'
    const req = { headers: { authorization: jwt.sign({ id: ownerId, tipo: 'funcionario' }, process.env.JWT_SECRET) } }
    let proceeded = false
    auth(req, {}, () => { proceeded = true })
    assert.equal(proceeded, true)
    assert.equal(req.user.tipo, 'admin')
    delete process.env.JWT_SECRET
    let status
    auth(req, { status(code) { status = code; return this }, json() {} }, () => assert.fail('Must fail without signing key'))
    assert.equal(status, 503)
})
