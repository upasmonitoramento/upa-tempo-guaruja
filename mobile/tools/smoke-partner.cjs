// Uses local fixtures only. No real partner, payment, email or storage is contacted.
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')
const { chromium, webkit } = require('playwright-core')
const root = path.resolve(__dirname, '../..')
const output = path.resolve(root, '../tmp/partner-review')
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' }
async function serverFor(kind) {
    const dir = path.join(root, kind === 'native' ? 'mobile/public' : 'frontend')
    const server = http.createServer(async (req, res) => {
        try {
            const file = path.resolve(dir, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'))
            if (!file.startsWith(dir + path.sep)) return res.writeHead(403).end()
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(await fs.readFile(file))
        } catch { res.writeHead(404).end() }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return { server, origin: 'http://127.0.0.1:' + server.address().port }
}
const account = { id: '692000000000000000000001', name: 'Parceiro de exemplo', email: 'parceiro@example.test', verifiedAt: '2026-11-18T12:00:00Z' }
function campaign() {
    return { id: '692000000000000000000002', company: 'Empresa de exemplo', packageName: 'Regional · 2 semanas', cities: ['Guarujá'], durationDays: 14, cents: 25000, paymentStatus: 'RECEIVED', paymentUrl: 'https://sandbox.asaas.com/i/example', requirements: [{ key: 'card-260x76', position: 'card', label: 'Cards das unidades', width: 260, height: 76, codes: ['ADS_11'] }], assets: [], revision: 0, reviewState: 'draft', destination: '' }
}
async function fixtures(context, p, image) {
    const requests = [], originalLoads = []
    let approvals = 0
    await context.route('**/*', route => {
        const req = route.request(), u = new URL(req.url())
        if (u.hostname === 'media.example.test') {
            originalLoads.push(u.pathname)
            return route.fulfill({ contentType: 'image/png', body: image })
        }
        if (!u.pathname.startsWith('/parceiros/') && !u.pathname.startsWith('/admin/parceiros/')) return route.continue()
        requests.push({ path: u.pathname, method: req.method() })
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' }
        const json = (data, status = 200) => route.fulfill({ headers, status, json: data })
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
        if (u.pathname === '/parceiros/config') return json({ emailReady: true, environment: 'sandbox' })
        if (u.pathname === '/parceiros/login') {
            const b = req.postDataJSON()
            return b.email === account.email && b.password === 'senha-de-teste' ? json({ token: 'partner-fixture-session', account }) : json({ erro: 'Não foi possível entrar. Confira os dados.' }, 401)
        }
        if (u.pathname === '/parceiros/link/consultar') return json({ kind: 'invite', existing: false, email: 'pa•••@example.test', company: p.company, packageName: p.packageName })
        if (u.pathname === '/parceiros/link/confirmar') { assert.equal(req.postDataJSON().policyAccepted, true); return json({ token: 'partner-fixture-session', account }) }
        if (u.pathname === '/parceiros/acesso/solicitar') return json({ msg: 'Se houver uma parceria elegível, enviaremos um link por email.' })
        if (u.pathname === '/parceiros/conta') return json(req.method() === 'PUT' ? { ...account, name: req.postDataJSON().name } : account)
        if (u.pathname === '/parceiros/sair') return route.fulfill({ status: 204, headers })
        if (u.pathname === '/parceiros/campanhas') {
            const filter = u.searchParams.get('state')
            const visible = filter === 'pending' ? p.reviewState === 'pending' : filter === 'active' ? p.reviewState === 'approved' : filter !== 'ended'
            return json({ items: visible ? [p] : [], next: null })
        }
        if (u.pathname.includes('/artes/')) {
            assert.ok(req.postDataBuffer().length > 0)
            p.assets = [{ key: p.requirements[0].key, url: 'https://media.example.test/original.webp', thumbnailUrl: 'https://media.example.test/thumbnail.webp', width: 260, height: 76, bytes: image.length, type: 'imagem' }]
            p.revision++; p.reviewState = 'draft'
            return json({ asset: p.assets[0], revision: p.revision })
        }
        if (u.pathname === '/parceiros/campanhas/' + p.id + '/revisao') { p.destination = req.postDataJSON().destination; p.reviewState = 'pending'; p.revision++; return json({ msg: 'Artes enviadas para revisão.' }) }
        if (u.pathname === '/admin/parceiros/revisoes') return json({ items: [{ ...p, _id: p.id }], next: null })
        if (u.pathname === '/admin/parceiros/campanhas/' + p.id) return json({ ...p, _id: p.id, email: account.email })
        if (u.pathname.endsWith('/preparar-aprovacao')) return json({ token: 'b'.repeat(64), start: '2026-11-19T03:00:00Z', end: '2026-12-03T03:00:00Z', cents: p.cents, company: p.company, packageName: p.packageName, cities: p.cities, formats: 1, paymentStatus: 'RECEIVED' })
        if (u.pathname.endsWith('/aprovar')) {
            assert.equal(req.postDataJSON().confirmed, true); approvals++; p.reviewState = 'approved'; p.campaignStart = '2026-11-19T03:00:00Z'; p.campaignEnd = '2026-12-03T03:00:00Z'
            return json({ msg: 'Campanha aprovada e programada.' })
        }
        return json({ erro: 'Rota de teste não configurada.' }, 404)
    })
    return { requests, originalLoads, approvals: () => approvals }
}
async function check(browser, kind, width) {
    const { server, origin } = await serverFor(kind)
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const page = await context.newPage(), errors = [], p = campaign()
    page.setDefaultTimeout(8000); page.on('pageerror', e => errors.push(e.message))
    const image = await sharp({ create: { width: 260, height: 76, channels: 3, background: '#1554b5' } }).png().toBuffer()
    const f = await fixtures(context, p, image)
    try {
        await page.goto(origin + '/parceiro.html')
        await page.getByRole('heading', { name: 'Entrar como parceiro' }).waitFor()
        await page.getByLabel('Email', { exact: true }).fill(account.email)
        await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste')
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        await page.getByRole('heading', { name: 'Suas campanhas' }).waitFor()
        assert.equal(await page.locator('.partner-nav button').count(), 3)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        const box = await page.locator('.partner-nav').boundingBox()
        if (width < 600) assert.ok(box.y >= 760, 'Mobile navigation must stay near the bottom')
        else assert.ok(box.x < 250 && box.width < 220, 'Desktop navigation must be a compact sidebar')
        await page.screenshot({ path: path.join(output, `${kind}-${width}-campanhas.png`), fullPage: true })
        await page.getByRole('button', { name: 'Publicadas', exact: true }).click()
        await page.getByRole('heading', { name: 'Nenhuma campanha nesta lista' }).waitFor()
        await page.getByRole('button', { name: 'Todas', exact: true }).click()
        await page.locator('.partner-nav').getByRole('button', { name: 'Artes', exact: true }).click()
        const destination = page.getByRole('textbox', { name: 'Link ao clicar no anúncio (opcional)' })
        await destination.fill('https://example.test/oferta')
        await page.getByRole('button', { name: 'Atualizar informações' }).click()
        await page.waitForFunction(() => !document.querySelector('[data-refresh]').disabled)
        assert.equal(await destination.inputValue(), 'https://example.test/oferta')
        await page.locator('input[type=file]').setInputFiles({ name: 'arte.png', mimeType: 'image/png', buffer: image })
        await page.getByText('Arquivo recebido', { exact: true }).waitFor()
        assert.equal(await destination.inputValue(), 'https://example.test/oferta')
        assert.equal(f.originalLoads.includes('/original.webp'), false, 'Original media must not download before preview')
        await page.getByRole('button', { name: 'Ver arquivo', exact: true }).click()
        await page.locator('#partnerDialog img').waitFor()
        await page.locator('#partnerDialog').getByRole('button', { name: 'Fechar', exact: true }).click()
        await page.getByRole('button', { name: 'Enviar para revisão', exact: true }).click()
        await page.getByText('Artes enviadas. Aguarde a revisão da equipe;', { exact: false }).waitFor()
        assert.equal(await page.locator('input[type=file]').count(), 0)
        await page.screenshot({ path: path.join(output, `${kind}-${width}-artes.png`), fullPage: true })
        await page.locator('.partner-nav').getByRole('button', { name: 'Conta', exact: true }).click()
        assert.equal(await page.getByLabel('Email validado', { exact: true }).isEditable(), false)
        await page.getByLabel('Nome de contato').fill('Nome atualizado')
        await page.getByRole('button', { name: 'Salvar nome' }).click()
        await page.getByText('Nome atualizado.', { exact: true }).waitFor()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        await page.screenshot({ path: path.join(output, `${kind}-${width}-conta.png`), fullPage: true })
        await page.getByRole('button', { name: 'Sair do portal' }).click()
        await page.getByRole('heading', { name: 'Entrar como parceiro' }).waitFor()
        await page.goto(origin + '/parceiro.html#invite=' + 'a'.repeat(64))
        await page.getByRole('heading', { name: 'Ative seu acesso' }).waitFor()
        assert.equal(new URL(page.url()).hash, '', 'Private invitation must be removed from the address bar')
        await page.getByLabel('Crie sua senha').fill('nova-senha-de-teste')
        await page.getByLabel('Repita a senha', { exact: true }).fill('nova-senha-de-teste')
        await page.getByRole('checkbox').check()
        await page.getByRole('button', { name: 'Validar email e criar acesso' }).click()
        await page.getByRole('heading', { name: 'Suas campanhas' }).waitFor()
        assert.ok(f.requests.every(r => !r.path.includes('a'.repeat(64))))
        assert.deepEqual(errors, [])
        console.log(`${kind} ${width}px: partner login, navigation, drafts, upload, review, account and invitation OK`)
    } finally { await context.close(); await new Promise(resolve => server.close(resolve)) }
}
async function admin(browser, width) {
    const { server, origin } = await serverFor('web'), context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
    const page = await context.newPage(), p = campaign()
    page.setDefaultTimeout(8000)
    p.assets = [{ key: p.requirements[0].key, url: 'https://media.example.test/original.webp', thumbnailUrl: 'https://media.example.test/thumbnail.webp', type: 'imagem', width: 260, height: 76, bytes: 1024 }]; p.reviewState = 'pending'; p.revision = 2
    const image = await sharp({ create: { width: 260, height: 76, channels: 3, background: '#1554b5' } }).png().toBuffer()
    const f = await fixtures(context, p, image)
    try {
        await page.goto(origin + '/proposta.html#invalid')
        await page.addScriptTag({ url: origin + '/partner-admin.js' })
        await page.addStyleTag({ url: origin + '/comercial.css' })
        await page.evaluate(() => {
            window.API = location.origin
            localStorage.setItem('token', 'fixture-admin-session')
            document.body.innerHTML = '<main class="commercial"><section id="reviewSection"></section><p id="reviewMessage" role="status"></p></main>'
            window.renderPartnerReviews(document.getElementById('reviewSection'), { message: text => { document.getElementById('reviewMessage').textContent = text } })
        })
        await page.getByRole('button', { name: 'Abrir ficha e artes' }).click()
        await page.getByRole('button', { name: 'Aprovar e conferir programação' }).waitFor()
        await page.screenshot({ path: path.join(output, `admin-${width}-revisao.png`), fullPage: true })
        await page.getByRole('button', { name: 'Aprovar e conferir programação' }).click()
        await page.getByRole('heading', { name: 'Confirmar aprovação', exact: true }).waitFor()
        assert.equal(f.approvals(), 0)
        assert.equal(await page.getByRole('button', { name: 'Confirmar aprovação e programação' }).isDisabled(), true)
        await page.getByRole('button', { name: 'Voltar à revisão' }).click()
        assert.equal(f.approvals(), 0)
        await page.getByRole('button', { name: 'Aprovar e conferir programação' }).click()
        await page.getByRole('checkbox').check()
        await page.getByRole('button', { name: 'Confirmar aprovação e programação' }).click()
        await page.getByText('Campanha aprovada e programada.', { exact: true }).waitFor()
        assert.equal(f.approvals(), 1)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        console.log(`admin ${width}px: two-stage approval requires explicit final confirmation OK`)
    } finally { await context.close(); await new Promise(resolve => server.close(resolve)) }
}
async function main() {
    await fs.mkdir(output, { recursive: true })
    const browser = await chromium.launch({ channel: 'chrome' })
    try { for (const width of [320, 390, 1440]) await check(browser, 'web', width); await check(browser, 'native', 390); for (const width of [390, 1440]) await admin(browser, width) }
    finally { await browser.close() }
    if (process.env.PARTNER_TEST_WEBKIT === '1') { const safari = await webkit.launch(); try { await check(safari, 'web', 390) } finally { await safari.close() } }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
