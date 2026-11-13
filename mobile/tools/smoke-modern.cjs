// Shared web + packaged mobile navigation checks. No production requests or real accounts.
// NODE_PATH must include playwright-core. Chrome is used by default.
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('playwright-core')
const photoAssets = require('../../frontend/images/units.json')
const repo = path.resolve(__dirname, '../..')
const screenshotRoot = path.resolve(repo, '../tmp/modern-review')
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
}
const fixture = photoAssets.slice(0, 2).map((asset, index) => ({
    _id: asset.id, upa: asset.name, endereco: 'Rua de exemplo, 100 - Guarujá - SP',
    foto: asset.originalURL, lat: -23.98 - index * 0.01, lng: -46.25,
    tempo_minutos: 20 + index * 20, tempo_espera: `${20 + index * 20} min`,
    medicosPlantao: [{ nome: 'Dra. Exemplo', especialidade: 'Clínico Geral' }], data: '2026-11-13T12:00:00Z'
}))
const emptyLists = ['/anuncios/publicos', '/areas-ads/publicas', '/admin/usuarios', '/patrocinadores', '/anuncios', '/areas-ads', '/admin/logs', '/comercial/painel']

async function staticServer(directory) {
    const root = await fs.realpath(directory)
    const server = http.createServer(async (request, response) => {
        try {
            const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
            const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name))
            if (!file.startsWith(root + path.sep) || !mime[path.extname(file)]) {
                response.writeHead(404).end(); return
            }
            const body = await fs.readFile(file)
            response.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' }).end(body)
        } catch { response.writeHead(404).end() }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return { server, origin: `http://127.0.0.1:${server.address().port}` }
}

async function view(page, expected) {
    await page.waitForFunction(value => document.body.dataset.portalView === value, expected)
}
async function noOverflow(page, label) {
    const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
    assert.ok(size.content <= size.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(size)}`)
}
async function capture(page, kind, width, name) {
    if (width !== 390 && width !== 1440) return
    await page.screenshot({ path: path.join(screenshotRoot, `${kind}-${width}-${name}.png`), animations: 'disabled' })
}
async function navigate(page, destination) {
    const nav = page.locator('#portalBottomNav')
    if (await nav.isVisible()) {
        await nav.locator(`[data-destination="${destination}"]`).click()
    } else {
        if (destination === 'home') await page.locator('.topbar').getByRole('button', { name: 'Início', exact: true }).click()
        if (destination === 'map') await page.locator('.topbar').getByRole('button', { name: 'Mapa', exact: true }).click()
        if (destination === 'favorites') await page.locator('#desktopFavorites').click()
        if (destination === 'account') await page.locator('.topbar').getByRole('button', { name: 'Conta', exact: true }).click()
    }
    await view(page, destination)
}

async function check(browser, kind, origin, width, height) {
    const mobile = width < 768
    const context = await browser.newContext({
        viewport: { width, height: height || (width === 1440 ? 1000 : 844) }, deviceScaleFactor: 1,
        isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', serviceWorkers: 'block'
    })
    const page = await context.newPage()
    page.setDefaultTimeout(9000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.accept())
    let signedIn = null
    const headers = {
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Expose-Headers': 'X-Portal-Commercial-Mode', 'X-Portal-Commercial-Mode': 'preparation'
    }
    await context.route('**/*', async route => {
        const request = route.request()
        const url = new URL(request.url())
        const api = url.pathname === '/atendimento' || url.pathname.startsWith('/auth/') || emptyLists.includes(url.pathname)
        if (api) {
            const json = (body, status = 200) => route.fulfill({ status, json: body, headers })
            if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
            if (url.pathname === '/atendimento') return json(fixture)
            if (emptyLists.includes(url.pathname)) return json([])
            if (url.pathname === '/auth/login') {
                const credentials = request.postDataJSON()
                const role = credentials.email.split('@')[0]
                if (!['admin', 'funcionario', 'usuario'].includes(role) || credentials.senha !== 'senha-de-teste') return json({ erro: 'Login inválido' }, 400)
                signedIn = { _id: '692000000000000000000001', id: '692000000000000000000001', nome: `Conta ${role}`, email: credentials.email, tipo: role, status: 'ativo' }
                return json({ token: `mock-${role}`, user: signedIn })
            }
            if (url.pathname === '/auth/perfil') return signedIn ? json(signedIn) : json({ erro: 'Sem sessão' }, 401)
            return json({}, 404)
        }
        if (url.origin === origin) return route.continue()
        return route.fulfill({ status: 204 })
    })
    try {
        await page.goto(origin)
        await page.locator('#conectaSplash').waitFor({state:'detached'})
        await page.locator('[data-city="guaruja"]').click()
        await page.locator('.unit-card').first().waitFor()
        await view(page, 'home')
        await noOverflow(page, `${kind}/${width}/home`)
        if (mobile) {
            assert.equal(await page.locator('#portalBottomNav').isVisible(), true)
            const header = await page.locator('.topbar').boundingBox()
            assert.ok(header.height <= 70, `Mobile header should be compact (${header.height}px)`)
            assert.equal(await page.locator('.topbar-buttons').isVisible(), false)
            await page.locator('#portalBottomNav [data-destination="home"][aria-current="page"]').waitFor()
        }
        await capture(page, kind, width, 'home')
        await navigate(page, 'favorites')
        assert.equal(await page.locator('.unit-card:visible').count(), 0, 'Fresh browser should have no favorites')
        await navigate(page, 'home')
        await page.locator('.unit-card').first().getByRole('button', { name: /Ver detalhes/ }).click()
        await view(page, 'detail')
        assert.equal(await page.locator('#portalBottomNav [aria-current="page"]').getAttribute('data-destination'), 'home', 'Detail should retain its home navigation destination')
        await page.locator('.detail-topline').waitFor()
        if (mobile) {
            assert.equal(await page.locator('#portalBottomNav').isVisible(), false)
            assert.equal(await page.locator('.topbar').isVisible(), false)
            assert.equal(await page.locator('#barraUpasMobile').isVisible(), false)
        }
        const favorite = page.locator('.detail-favorite')
        await favorite.click()
        assert.equal(await favorite.getAttribute('aria-pressed'), 'true')
        assert.equal(await favorite.getAttribute('aria-label'), 'Remover dos favoritos')
        assert.notEqual(await favorite.locator('svg').evaluate(el=>getComputedStyle(el).fill),'none')
        await page.getByText('Unidade salva nos favoritos.',{exact:true}).waitFor()
        await noOverflow(page, `${kind}/${width}/detail`)
        await capture(page, kind, width, 'detail')
        await page.getByRole('button', { name: 'Voltar para unidades', exact: true }).click()
        await view(page, 'home')
        await navigate(page, 'favorites')
        assert.equal(await page.locator('.unit-card:visible').count(), 1)
        await page.locator('.unit-card:visible').first().getByRole('button', { name: /Ver detalhes/ }).click()
        await view(page, 'detail')
        assert.equal(await page.locator('#portalBottomNav [aria-current="page"]').getAttribute('data-destination'), 'favorites', 'Favorite detail should retain its favorites navigation destination')
        await page.getByRole('button', { name: 'Voltar para unidades', exact: true }).click()
        await view(page, 'favorites')
        assert.equal(await page.locator('.unit-card:visible').count(), 1, 'Detail back should preserve the favorites destination')
        await page.reload()
        await page.locator('#conectaSplash').waitFor({state:'detached'})
        await page.locator('[data-city="guaruja"]').click()
        await page.locator('.unit-card').first().waitFor()
        await navigate(page, 'favorites')
        assert.equal(await page.locator('.unit-card:visible').count(), 1, 'Favorite should survive a reload')
        await navigate(page, 'map')
        await page.locator('.leaflet-container').waitFor()
        await page.locator('.conecta-map-pin svg').first().waitFor()
        assert.equal(await page.locator('.conecta-map-pin svg').count(),fixture.length)
        assert.equal(await page.locator('.leaflet-marker-pane img').count(),0)
        await page.locator('.conecta-map-pin').first().click()
        const popupName = await page.evaluate(unit=>nomeCurtoUPA(unit),fixture[0])
        await page.locator('.leaflet-popup-content').getByText(popupName,{exact:true}).waitFor()
        await noOverflow(page, `${kind}/${width}/map`)
        await navigate(page, 'account')
        await page.locator('#accountLogin').waitFor()
        assert.equal(await page.locator('#portalAccount [data-profile]').isVisible(), false, 'Guest must not see profile action')
        assert.equal(await page.locator('#portalAccount [data-logout]').isVisible(), false, 'Guest must not see logout action')
        await capture(page, kind, width, 'account-guest')
        await page.locator('#accountLogin').click()
        await view(page, 'login')
        const loginRole = width === 375 ? 'funcionario' : 'admin'
        await page.locator('#email').fill(`${loginRole}@example.test`)
        await page.locator('#senha').fill('senha-de-teste')
        await page.locator('#loginBox').getByRole('button', { name: 'Entrar', exact: true }).click()
        await page.waitForFunction(() => getUser()?.tipo === 'admin' || getUser()?.tipo === 'funcionario')
        await navigate(page, 'account')
        const account = page.locator('#portalAccount')
        await account.getByText(`Conta ${loginRole}`, { exact: true }).waitFor()
        assert.equal(await page.locator('#accountLogin').isVisible(), false, 'Signed-in user must not see login action')
        await account.getByRole('button', { name: 'Meu perfil', exact: true }).waitFor()
        await account.getByRole('button', { name: 'Atualizar atendimento', exact: true }).waitFor()
        assert.equal(await account.getByRole('button', { name: 'Administração', exact: true }).count(), loginRole === 'admin' ? 1 : 0)
        assert.equal(await account.getByRole('button', { name: 'Publicidade', exact: true }).count(), loginRole === 'admin' ? 1 : 0)
        await noOverflow(page, `${kind}/${width}/account`)
        await capture(page, kind, width, 'account')
        await account.getByRole('button', { name: 'Atualizar atendimento', exact: true }).click()
        await view(page, 'form')
        await page.locator('#formulario').waitFor()
        await noOverflow(page, `${kind}/${width}/staff`)
        const ads = await page.evaluate(() => {
            const image = document.createElement('div')
            image.innerHTML = criarMidiaAnuncioPublico({ nome:'Anúncio <teste>', midia:'https://example.test/banner.png', tipoMidia:'imagem' })
            const video = document.createElement('div')
            video.innerHTML = criarMidiaAnuncioPublico({ nome:'Vídeo', midia:'https://example.test/video.mp4', tipoMidia:'video' })
            const admin = document.createElement('div')
            admin.innerHTML = renderizarMidiaAnuncio({midia:'https://example.test/x\" onerror=\"alert(1)',tipoMidia:'imagem'})
            return { image:image.querySelector('img')?.alt, video:video.querySelector('video')?.getAttribute('preload'),
                controls:video.querySelector('video')?.controls, unsafeHandler:admin.querySelector('img')?.hasAttribute('onerror'),
                unsafeLink:linkSeguroAnuncio('javascript:alert(1)'), safeLink:linkSeguroAnuncio('https://example.test/anuncio') }
        })
        assert.equal(ads.image,'Anúncio <teste>')
        assert.equal(ads.video,'none')
        assert.equal(ads.controls,true)
        assert.equal(ads.unsafeHandler,false)
        assert.ok(!ads.unsafeLink)
        assert.equal(ads.safeLink,'https://example.test/anuncio')
        assert.deepEqual(errors, [], 'No JavaScript errors should be emitted')
        console.log(`${kind} ${width}px: home, detail, favorites, map, account, staff permissions OK`)
    } catch (error) {
        const currentView = await page.locator('body').getAttribute('data-portal-view')
        console.error({ kind, width, currentView, errors, text: (await page.locator('body').innerText()).slice(0, 650) })
        throw error
    } finally { await context.close() }
}

async function main() {
    await fs.mkdir(screenshotRoot, { recursive: true })
    const browser = await chromium.launch({ channel: process.env.MOBILE_BROWSER_CHANNEL || 'chrome' })
    try {
        for (const [kind, directory] of [['web', path.join(repo, 'frontend')], ['native', path.join(repo, 'mobile/public')]]) {
            const { server, origin } = await staticServer(directory)
            try {
                for (const width of [320, 375, 390, 1440]) await check(browser, kind, origin, width)
                await check(browser, kind, origin, 844, 390)
            } finally { await new Promise(resolve => server.close(resolve)) }
        }
    } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
