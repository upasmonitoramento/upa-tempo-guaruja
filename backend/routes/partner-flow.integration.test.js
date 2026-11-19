const test = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const enabled = process.env.PARTNER_INTEGRATION_LOCAL === '1'

test('portal completo: convite, isolamento, artes, revisão, publicação, estorno e bloqueio', { skip: !enabled, timeout: 180000 }, async t => {
    require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true })
    const mongoose = require('mongoose'), express = require('express'), jwt = require('jsonwebtoken'), bcrypt = require('bcrypt'), sharp = require('sharp')
    const name = 'conecta_qa_partner_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + randomBytes(4).toString('hex')
    assert.match(name, /^conecta_qa_partner_\d{8}_[a-f\d]{8}$/)
    await mongoose.connect(process.env.MONGO_URI, { dbName: name, serverSelectionTimeoutMS: 7000 })
    t.after(async () => {
        assert.equal(mongoose.connection.name, name)
        assert.match(mongoose.connection.name, /^conecta_qa_partner_/)
        try { await mongoose.connection.dropDatabase() } finally { await mongoose.disconnect() }
    })
    delete process.env.VERCEL_ENV
    Object.assign(process.env, { JWT_SECRET: 'integration-only-secret-not-a-production-key', ASAAS_SANDBOX_API_KEY: 'not-a-real-key', ASAAS_SANDBOX_WEBHOOK_TOKEN: 'integration-webhook', PORTAL_COMERCIAL_TESTE: '1' })
    const User = require('../models/User'), Account = require('../models/PartnerAccount'), P = require('../models/CommercialPartnership')
    const Ad = require('../models/Anuncio'), Sponsor = require('../models/Patrocinador'), Area = require('../models/AreaAds'), Token = require('../models/PartnerToken')
    const email = require('../config/recoveryEmail'), storage = require('../config/r2')
    const letters = [], uploads = [], deletes = []
    t.mock.method(email, 'configured', () => true)
    t.mock.method(email, 'sendMessage', async (to, subject, text) => { letters.push({ to, subject, text }) })
    t.mock.method(storage, 'uploadArquivoR2', async file => {
        const key = 'parceiros/qa-' + (uploads.length + 1) + '.webp'; uploads.push({ key, bytes: file.buffer.length })
        return { key, url: 'https://media.example.test/' + key }
    })
    t.mock.method(storage, 'deletePartnerAsset', async key => { deletes.push(key) })
    const admin = await User.create({ tipo: 'admin', status: 'ativo', nome: 'Administrador QA', email: 'admin@example.test', cpf: '11111111111', senha: 'unused' })
    const staff = await User.create({ tipo: 'funcionario', status: 'ativo', nome: 'Funcionário QA', email: 'staff@example.test', cpf: '22222222222', senha: 'unused' })
    const other = await Account.create({ email: 'other@example.test', password: await bcrypt.hash('password-qa-only', 10), environment: 'sandbox', active: true, verifiedAt: new Date() })
    const campaign = await P.create({ company: 'Empresa fictícia QA', email: 'partner@example.test', representative: 'Parceiro QA', document: '00000000000', packageName: 'Duas semanas', cities: ['Guarujá'], positions: ['card'], cents: 25000, durationDays: 14, portalVersion: 1, accepted: new Date(), customerId: 'cus_qa', paymentId: 'pay_qa', paymentStatus: 'PENDING' })
    await Area.create({ numero: 11, codigo: 'ADS_11', nome: '11', posicao: 'card', larguraPx: 260, alturaPx: 76, status: 'ativo' })
    await Promise.all([User.init(), Account.init(), P.init(), Token.init(), Ad.init(), Sponsor.init(), Area.init()])
    const originalFetch = fetch
    let providerStatus = 'PENDING', badAmount = false, providerCalls = 0
    t.mock.method(global, 'fetch', async (url, options) => {
        providerCalls++
        assert.equal(url, 'https://api-sandbox.asaas.com/v3/payments/pay_qa', 'Only the known mock payment can be consulted')
        assert.equal(options.method, 'GET', 'This test must never create a payment')
        return Response.json({ id: 'pay_qa', customer: 'cus_qa', externalReference: String(campaign._id), billingType: 'PIX', value: badAmount ? 249 : 250, status: providerStatus, invoiceUrl: 'https://sandbox.asaas.com/i/qa' })
    })
    const app = express(); app.use(express.json())
    app.use('/parceiros', require('./parceiros')); app.use('/admin/parceiros', require('./partnerAdmin'))
    app.use('/anuncios', require('./anuncios')); app.use('/areas-ads', require('./areasAds')); app.use('/comercial', require('./comercial'))
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const origin = 'http://127.0.0.1:' + server.address().port
    const adminToken = jwt.sign({ id: admin._id, tipo: 'admin' }, process.env.JWT_SECRET)
    const staffToken = jwt.sign({ id: staff._id, tipo: 'admin' }, process.env.JWT_SECRET)
    const foreignToken = jwt.sign({ sub: String(other._id), version: 0, environment: 'sandbox' }, process.env.JWT_SECRET, { audience: 'conecta-partner' })
    const call = (path, method = 'GET', body, token) => originalFetch(origin + path, { method, headers: { ...(token ? { Authorization: token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    const adminPath = '/admin/parceiros/campanhas/' + campaign._id
    const partnerPath = '/parceiros/campanhas/' + campaign._id
    assert.equal((await call(adminPath + '/convite', 'POST', {}, staffToken)).status, 403)
    assert.equal((await call(adminPath + '/convite', 'POST', {}, adminToken)).status, 409)
    assert.equal(letters.length, 0)
    providerStatus = 'RECEIVED'
    assert.equal((await call(adminPath + '/convite', 'POST', {}, adminToken)).status, 200)
    const invite = letters[0].text.match(/#invite=([a-f\d]{64})/)[1]
    assert.equal(letters[0].to, 'partner@example.test')
    assert.equal((await call('/parceiros/link/confirmar', 'POST', { token: 'a'.repeat(64), password: 'password-qa-only', policyAccepted: true })).status, 410)
    const activation = await call('/parceiros/link/confirmar', 'POST', { token: invite, password: 'password-qa-only', policyAccepted: true })
    assert.equal(activation.status, 200)
    const partnerSession = await activation.json(), partnerToken = partnerSession.token
    assert.equal(partnerSession.account.email, 'partner@example.test')
    assert.equal((await call('/parceiros/link/confirmar', 'POST', { token: invite, password: 'new-password-qa', policyAccepted: true })).status, 410)
    assert.equal((await call(partnerPath, 'GET', null, foreignToken)).status, 404)
    assert.equal((await call('/admin/parceiros/revisoes', 'GET', null, partnerToken)).status, 401)
    assert.equal((await call('/parceiros/conta', 'GET', null, adminToken)).status, 401)
    const read = async () => (await call(partnerPath, 'GET', null, partnerToken)).json()
    let p = await read()
    assert.equal(p.requirements.length, 1)
    assert.equal(p.requirements[0].width, 260)
    const small = await sharp({ create: { width: 260, height: 76, channels: 3, background: '#1554b5' } }).png().toBuffer()
    const wrong = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#1554b5' } }).png().toBuffer()
    async function upload(buffer, revision = p.revision, token = partnerToken, filename = 'arte.png', type = 'image/png') {
        const body = new FormData(); body.append('file', new Blob([buffer], { type }), filename)
        return originalFetch(origin + partnerPath + '/artes/' + p.requirements[0].key + '?revision=' + revision, { method: 'POST', headers: { Authorization: token }, body })
    }
    assert.equal((await upload(small, p.revision, foreignToken)).status, 404)
    assert.equal((await upload(wrong)).status, 422)
    assert.equal((await upload(Buffer.from('<script>bad</script>'))).status, 422)
    assert.equal(uploads.length, 0)
    assert.equal((await upload(small)).status, 200)
    p = await read()
    assert.equal(p.assets.length, 1); assert.equal(uploads.length, 2)
    assert.equal((await upload(small, 0)).status, 409)
    assert.equal((await call(partnerPath + '/revisao', 'POST', { revision: p.revision, destination: 'javascript:alert(1)' }, partnerToken)).status, 400)
    providerStatus = 'PENDING'
    assert.equal((await call(partnerPath + '/revisao', 'POST', { revision: p.revision, destination: 'https://example.test/' }, partnerToken)).status, 409)
    providerStatus = 'RECEIVED'
    assert.equal((await call(partnerPath + '/revisao', 'POST', { revision: p.revision, destination: 'https://example.test/' }, partnerToken)).status, 200)
    p = await read(); assert.equal(p.reviewState, 'pending')
    assert.equal((await upload(small)).status, 409)
    badAmount = true
    assert.equal((await call(adminPath + '/preparar-aprovacao', 'POST', { revision: p.revision }, adminToken)).status, 409)
    badAmount = false
    let preflight = await (await call(adminPath + '/preparar-aprovacao', 'POST', { revision: p.revision }, adminToken)).json()
    assert.equal((await call(adminPath + '/aprovar', 'POST', { revision: p.revision, token: preflight.token, confirmed: false }, adminToken)).status, 400)
    let failWrite = true
    const updateAreas = Area.updateMany
    t.mock.method(Area, 'updateMany', function (...args) {
        if (failWrite && args[0].codigo) { failWrite = false; throw new Error('Simulated partial publication failure') }
        return updateAreas.apply(this, args)
    })
    assert.equal((await call(adminPath + '/aprovar', 'POST', { revision: p.revision, token: preflight.token, confirmed: true }, adminToken)).status, 503)
    await Ad.updateMany({ partnership: campaign._id }, { $set: { dataInicio: new Date(Date.now() - 86400000) } })
    assert.equal((await (await call('/anuncios/publicos')).json()).length, 0, 'Partial writes must not expose advertisements')
    preflight = await (await call(adminPath + '/preparar-aprovacao', 'POST', { revision: p.revision }, adminToken)).json()
    const released = await call(adminPath + '/aprovar', 'POST', { revision: p.revision, token: preflight.token, confirmed: true }, adminToken)
    assert.equal(released.status, 200, await released.text())
    assert.equal(await Ad.countDocuments({ partnership: campaign._id }), 1, 'Retry must not duplicate the advertisement')
    p = await read()
    assert.equal(p.reviewState, 'approved')
    assert.equal(+new Date(p.campaignEnd) - +new Date(p.campaignStart), 14 * 86400000)
    assert.equal((await call(adminPath + '/aprovar', 'POST', { revision: p.revision, token: preflight.token, confirmed: true }, adminToken)).status, 409)
    const start = new Date(Date.now() - 86400000), end = new Date(+start + 14 * 86400000)
    await Ad.updateMany({ partnership: campaign._id }, { $set: { dataInicio: start, dataFim: end } })
    await P.updateOne({ _id: campaign._id }, { $set: { campaignStart: start, campaignEnd: end } })
    assert.equal((await (await call('/anuncios/publicos')).json()).length, 1)
    const publicAreas = await (await call('/areas-ads/publicas')).json()
    assert.equal(publicAreas.find(a => a.codigo === 'ADS_11').anunciosAtuais.length, 1)
    assert.equal(JSON.stringify(publicAreas).includes('partner@example.test'), false, 'Private sponsor data must not leak through areas')
    providerStatus = 'REFUNDED'
    const webhook = () => originalFetch(origin + '/comercial/asaas/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': 'integration-webhook' }, body: JSON.stringify({ payment: { id: 'pay_qa', status: 'RECEIVED' } }) })
    assert.equal((await webhook()).status, 200)
    assert.equal((await (await call('/anuncios/publicos')).json()).length, 0, 'A forged webhook status cannot override the provider')
    assert.equal((await (await call('/areas-ads/publicas')).json()).find(a => a.codigo === 'ADS_11').anunciosAtuais.length, 0)
    providerStatus = 'RECEIVED'; assert.equal((await webhook()).status, 200)
    const deletedBefore = deletes.length
    p = await read()
    const simultaneous = await Promise.all([upload(small, p.revision), upload(small, p.revision)])
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 409])
    assert.equal(deletes.length, deletedBefore, 'The currently published artwork must be retained during a draft replacement')
    p = await read()
    assert.equal((await call(partnerPath + '/revisao', 'POST', { revision: p.revision, destination: 'https://example.test/new' }, partnerToken)).status, 200)
    p = await read()
    preflight = await (await call(adminPath + '/preparar-aprovacao', 'POST', { revision: p.revision }, adminToken)).json()
    assert.equal(+new Date(preflight.end), +end, 'Replacing artwork must not extend the paid period')
    assert.equal((await call(adminPath + '/aprovar', 'POST', { revision: p.revision, token: preflight.token, confirmed: true }, adminToken)).status, 200)
    assert.equal((await (await call('/anuncios/publicos')).json()).length, 1)
    for (let i = 0; i < 3; i++) assert.equal((await call('/parceiros/login', 'POST', { email: 'partner@example.test', password: 'wrong-password' })).status, 401)
    assert.equal((await call('/parceiros/conta', 'GET', null, partnerToken)).status, 401)
    assert.equal((await call('/parceiros/login', 'POST', { email: 'partner@example.test', password: 'password-qa-only' })).status, 401)
    const unlock = letters.findLast(letter => letter.text.includes('#unlock='))?.text.match(/#unlock=([a-f\d]{64})/)[1]
    assert.ok(unlock)
    assert.equal((await call('/parceiros/link/confirmar', 'POST', { token: unlock, password: 'new-password-qa' })).status, 200)
    assert.equal((await call('/parceiros/link/confirmar', 'POST', { token: unlock, password: 'new-password-qa' })).status, 410)
    const recoveredLogin = await call('/parceiros/login', 'POST', { email: 'partner@example.test', password: 'new-password-qa' })
    assert.equal(recoveredLogin.status, 200)
    const recoveredToken = (await recoveredLogin.json()).token
    assert.equal((await call('/parceiros/conta', 'GET', null, partnerToken)).status, 401)
    const recoveredAccount = await Account.findOne({ email: 'partner@example.test' })
    await P.insertMany(Array.from({ length: 12 }, (_, i) => ({ company: 'Histórico QA ' + i, email: recoveredAccount.email, partnerAccount: recoveredAccount._id, reviewState: 'draft' })))
    const first = await (await call('/parceiros/campanhas?state=all', 'GET', null, recoveredToken)).json()
    const second = await (await call('/parceiros/campanhas?state=all&before=' + first.next, 'GET', null, recoveredToken)).json()
    assert.equal(first.items.length, 10); assert.equal(second.items.length, 3)
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 13)
    assert.equal((await call('/parceiros/campanhas?before=invalid', 'GET', null, recoveredToken)).status, 400)
    // Courtesy grants work even with commercial billing disabled. All data remains in this QA database.
    const sponsor = await Sponsor.create({ empresaNome: 'Empresa cortesia QA', responsavelNome: 'Titular QA', documentoResponsavel: '00000000000', tipoDocumentoResponsavel: 'cpf', email: 'courtesy@example.test', status: 'ativo' })
    const body = { sponsor: String(sponsor._id), email: 'partner@example.test', reason: 'Divulgação própria em QA', positions: ['card'], durationDays: 14, confirmed: true }
    const fundingCalls = providerCalls
    assert.equal((await call('/admin/parceiros/cortesias', 'POST', body, staffToken)).status, 403)
    assert.equal((await call('/admin/parceiros/cortesias', 'POST', body, recoveredToken)).status, 401)
    assert.equal((await call('/admin/parceiros/cortesias', 'POST', { ...body, confirmed: false }, adminToken)).status, 400)
    const grant = await call('/admin/parceiros/cortesias', 'POST', body, adminToken)
    assert.equal(grant.status, 201, await grant.clone().text())
    const courtesyId = (await grant.json()).id, cpath = '/admin/parceiros/campanhas/' + courtesyId
    let cp = await P.findById(courtesyId)
    assert.equal(cp.cents, 0); assert.equal(cp.paymentStatus, undefined); assert.equal(cp.paymentId, undefined)
    assert.equal(String(cp.courtesyGrantedBy), String(admin._id))
    assert.equal((await call(cpath + '/aprovar', 'POST', {}, adminToken)).status, 400)
    assert.equal((await call('/comercial/propostas/' + courtesyId + '/pix', 'POST', {}, adminToken)).status, 409)
    const adminUpload = async revision => { const form = new FormData(); form.append('file', new Blob([small], { type: 'image/png' }), 'cortesia.png'); return originalFetch(origin + cpath + '/artes/' + cp.requirements[0].key + '?revision=' + revision, { method: 'POST', headers: { Authorization: adminToken }, body: form }) }
    assert.equal((await adminUpload(cp.revision)).status, 200)
    cp = await P.findById(courtesyId)
    assert.equal((await call(cpath + '/revisao', 'POST', { revision: cp.revision, destination: 'https://example.test/cortesia' }, adminToken)).status, 200)
    cp = await P.findById(courtesyId)
    const oldEnv = process.env.VERCEL_ENV; process.env.VERCEL_ENV = 'production'
    let courtesyApproval
    try {
        const check = await call(cpath + '/preparar-aprovacao', 'POST', { revision: cp.revision }, adminToken)
        assert.equal(check.status, 200, await check.clone().text()); courtesyApproval = await check.json()
        assert.equal(courtesyApproval.fundingType, 'courtesy'); assert.equal(courtesyApproval.cents, 0)
        assert.equal((await call(cpath + '/aprovar', 'POST', { revision: cp.revision, token: courtesyApproval.token, confirmed: true }, adminToken)).status, 200)
    } finally { if (oldEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnv }
    assert.equal(providerCalls, fundingCalls, 'Courtesy must never call Asaas')
    assert.equal(await Sponsor.countDocuments({ _id: sponsor._id }), 1)
    assert.equal(await Ad.countDocuments({ partnership: courtesyId }), 1)
    await Ad.updateMany({ partnership: courtesyId }, { $set: { dataInicio: start, dataFim: end } })
    await P.updateOne({ _id: courtesyId }, { $set: { campaignStart: start, campaignEnd: end } })
    let publicRows = await (await call('/anuncios/publicos')).json()
    assert.ok(publicRows.some(a => String(a.patrocinador._id) === String(sponsor._id)))
    assert.equal((await call(cpath + '/convite', 'POST', {}, adminToken)).status, 200)
    const courtesyInvite = letters.at(-1).text.match(/#invite=([a-f\d]{64})/)[1]
    assert.ok(letters.at(-1).text.includes('cortesia'))
    assert.equal((await call('/parceiros/link/confirmar', 'POST', { token: courtesyInvite })).status, 409, 'An existing partner account must sign in before binding')
    assert.equal((await call('/parceiros/link/confirmar', 'POST', { token: courtesyInvite }, recoveredToken)).status, 200)
    const ownCourtesy = await (await call('/parceiros/campanhas/' + courtesyId, 'GET', null, recoveredToken)).json()
    assert.equal(ownCourtesy.fundingType, 'courtesy'); assert.equal(ownCourtesy.cents, 0)
    assert.equal(ownCourtesy.courtesyGrantedBy, undefined)
    cp = await P.findById(courtesyId)
    assert.equal((await call(cpath + '/encerrar-cortesia', 'POST', { revision: cp.revision, confirmed: false }, adminToken)).status, 409)
    assert.equal((await call(cpath + '/encerrar-cortesia', 'POST', { revision: cp.revision, confirmed: true }, staffToken)).status, 403)
    assert.equal((await call(cpath + '/encerrar-cortesia', 'POST', { revision: cp.revision, confirmed: true }, adminToken)).status, 200)
    assert.equal((await call(cpath + '/aprovar', 'POST', { revision: cp.revision, token: courtesyApproval.token, confirmed: true }, adminToken)).status, 409)
    assert.equal((await adminUpload(cp.revision)).status, 409)
    assert.equal((await call(cpath + '/convite', 'POST', {}, adminToken)).status, 409)
    publicRows = await (await call('/anuncios/publicos')).json()
    assert.equal(publicRows.some(a => String(a.patrocinador._id) === String(sponsor._id)), false)
    const courtesyAreas = await (await call('/areas-ads/publicas')).json()
    assert.equal(courtesyAreas.some(a => a.anunciosAtuais.some(ad => String(ad.patrocinador._id) === String(sponsor._id))), false)
    assert.equal(providerCalls, fundingCalls)

})
