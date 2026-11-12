// Start the mobile preview first. Requires playwright-core on the Node module path.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium, devices, webkit } = require('playwright-core')
const units = require('../../frontend/images/units.json')

const preview = new URL(process.env.MOBILE_PREVIEW_URL || 'http://127.0.0.1:3199')
const apiOrigin = new URL(process.env.MOBILE_API_ORIGIN || 'https://upa-tempo-guaruja.vercel.app').origin
const unit = {
    _id: '69bc11061d88092c22b1e6e3', upa: 'UPA Rodoviária',
    endereco: 'Av. Santos Dumont, 856 - Guarujá - SP',
    lat: -23.986, lng: -46.256, tempo_minutos: 20, tempo_espera: '20 min',
    medicosPlantao: [{ nome: 'Dra. Exemplo', especialidade: 'Clínico Geral' }],
    data: '2026-03-19T15:06:00Z',
    foto: units.find(({ id }) => id === '69bc11061d88092c22b1e6e3').originalURL
}
const publicLists = ['/anuncios/publicos', '/areas-ads/publicas']
const adminLists = ['/admin/usuarios', '/patrocinadores', '/anuncios', '/areas-ads', '/admin/logs']
const screenshotRoot = process.env.MOBILE_TEST_SCREENSHOTS

async function capture(page, device, screen) {
    if (!screenshotRoot || device !== 'iPhone 15 Pro') return
    await page.screenshot({ path: path.join(screenshotRoot, `iphone-15-pro-${screen}.png`) })
}

async function openPortal(browser, role, device) {
    const context = await browser.newContext({ ...devices[device], reducedMotion: 'reduce', serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(8000)
    const user = { nome: `Conta ${role}`, email: `${role}@example.test`, tipo: role }
    const token = `mock-${role}`
    const requests = []
    const errors = []
    const dialogs = []
    let connected = true
    let currentUnit = { ...unit }
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => {
        dialogs.push(dialog.message())
        return dialog.accept()
    })

    await context.route('**/*', async route => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.origin === preview.origin) return route.continue()
        if (url.origin !== apiOrigin) return route.fulfill({ status: 204 })
        if (!connected) return route.abort('internetdisconnected')

        const method = request.method()
        const pathname = url.pathname
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, content-type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
        }
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders })
        const json = (body, status = 200) => route.fulfill({
            status, json: body, headers: corsHeaders
        })
        requests.push(`${method} ${pathname}`)

        if (method === 'GET' && pathname === '/atendimento') return json([currentUnit])
        if (method === 'GET' && publicLists.includes(pathname)) return json([])
        if (method === 'POST' && pathname === '/auth/login') {
            const credentials = request.postDataJSON()
            return credentials.email === user.email && credentials.senha === 'senha-de-teste'
                ? json({ token, user }) : json({ erro: 'Login inválido' }, 400)
        }
        if (request.headers().authorization !== token) return json({ erro: 'Sem sessão' }, 401)
        if (method === 'GET' && pathname === '/auth/perfil') return json(user)
        if (method === 'GET' && adminLists.includes(pathname)) {
            return role === 'admin' ? json([]) : json({ erro: 'Sem permissão' }, 403)
        }
        if (method === 'PUT' && pathname === `/atendimento/${unit._id}` && role !== 'usuario') {
            const body = request.postData() || ''
            if (!body.includes('name="tempo_minutos"\r\n\r\n45')) return json({ erro: 'Tempo inesperado' }, 400)
            currentUnit = { ...unit, tempo_minutos: 45, tempo_espera: '45 min' }
            return json({ atendimento: currentUnit })
        }
        return json({ erro: 'Rota de teste não configurada' }, 404)
    })

    await page.goto(preview.href)
    await page.getByRole('heading', { name: unit.upa }).waitFor()
    return { context, page, user, requests, errors, dialogs, setConnected: value => { connected = value } }
}

async function publicFlow(page, setConnected, device) {
    const firstCard = page.locator('.unit-card').first()
    assert.equal(await firstCard.getByText('Pessoas aguardando').count(), 0)
    await firstCard.getByRole('button', { name: `Ver detalhes de ${unit.upa}` }).click()
    const detail = page.locator('.unit-detail')
    await detail.getByRole('heading', { name: unit.upa }).waitFor()
    for (const text of ['DADOS DE DEMONSTRAÇÃO', 'Pessoas aguardando', 'Não informado', 'Dra. Exemplo', 'Horário do plantão não informado']) {
        await detail.getByText(text, { exact: true }).waitFor()
    }
    await page.waitForFunction(() => document.querySelector('.unit-detail img.unit-card-photo')?.naturalWidth > 0)
    await detail.getByRole('link', { name: /\(13\)/ }).waitFor()
    await detail.getByRole('button', { name: 'Abrir rota' }).waitFor()
    await capture(page, device, 'detalhes')
    await detail.getByRole('button', { name: '☆ Favoritar unidade' }).click()
    await detail.getByRole('button', { name: '★ Unidade favorita', pressed: true }).waitFor()
    await detail.getByRole('button', { name: 'Ver todas no mapa' }).click()
    await page.locator('.leaflet-container .leaflet-marker-icon').first().waitFor()
    await page.getByRole('button', { name: 'Início', exact: true }).click()
    await page.getByRole('button', { name: '☆ Ver favoritas' }).click()
    await firstCard.getByRole('heading', { name: unit.upa }).waitFor()

    setConnected(false)
    await page.reload()
    await page.getByText(/Sem conexão com o portal/).waitFor()
    await page.getByRole('button', { name: `Ver detalhes de ${unit.upa}` }).click()
    await detail.getByRole('button', { name: '★ Unidade favorita', pressed: true }).waitFor()
    assert.equal(await detail.getByText('Dra. Exemplo', { exact: true }).count(), 0)
    assert.equal(await detail.getByText('20 min', { exact: true }).count(), 0)
    await detail.getByRole('link', { name: /\(13\)/ }).waitFor()
    await detail.getByRole('button', { name: 'Todas as unidades' }).click()
    setConnected(true)
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await firstCard.getByText('20 min', { exact: true }).waitFor()
}

async function checkRole(browser, role, device) {
    const { context, page, user, requests, errors, dialogs, setConnected } = await openPortal(browser, role, device)
    try {
        if (role === 'usuario') await publicFlow(page, setConnected, device)
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        if (role === 'usuario') await capture(page, device, 'entrar')
        await page.getByLabel('E-mail', { exact: true }).fill(user.email)
        await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste')
        await page.locator('#login').getByRole('button', { name: 'Entrar', exact: true }).click()
        await page.getByRole('button', { name: 'Conta', exact: true }).click()
        const admin = page.locator('#btnPainelAdmin')
        const edit = page.locator('#btnCadastrar')
        assert.equal(await admin.isVisible(), role === 'admin')
        assert.equal(await edit.isVisible(), role !== 'usuario')

        if (role === 'admin') {
            await admin.click()
            const adminPanel = page.locator('#adminPanel')
            await adminPanel.getByRole('heading', { name: 'Painel Administrativo' }).waitFor()
            await adminPanel.getByText('Nenhum usuário encontrado.', { exact: true }).waitFor()
            await capture(page, device, 'administrador')
            const tabs = [
                ['Usuários', 'Nenhum usuário encontrado.'],
                ['Patrocinadores', 'Nenhum patrocinador encontrado.'],
                ['Anúncios', 'Nenhum anúncio encontrado.'],
                ['Espaços', 'Nenhuma área de ADS encontrada.'],
                ['Histórico', 'Nenhum log encontrado.']
            ]
            for (const [name, message] of tabs) {
                await adminPanel.getByRole('button', { name, exact: true }).click()
                await adminPanel.getByText(message, { exact: true }).waitFor()
            }
            for (const endpoint of adminLists) assert.ok(requests.includes(`GET ${endpoint}`), endpoint)
        } else {
            assert.ok(!requests.some(request => request.startsWith('GET /admin/')))
        }

        if (role === 'funcionario') {
            await page.getByRole('button', { name: 'Conta', exact: true }).click()
            await edit.click()
            assert.equal(await page.locator('.medicoNomePlantao').first().inputValue(), 'Dra. Exemplo')
            await capture(page, device, 'funcionario')
            await page.locator('#tempo').fill('45')
            await page.locator('#formulario').getByRole('button', { name: 'Salvar', exact: true }).click()
            await page.locator('.unit-card').getByText('45 min', { exact: true }).waitFor()
            assert.ok(requests.includes(`PUT /atendimento/${unit._id}`))
        }

        assert.ok(requests.includes('POST /auth/login'))
        assert.deepEqual(errors, [])
        console.log(`${device}: ${role} OK`)
    } catch (error) {
        const visibleContent = (await page.locator('body').innerText()).slice(0, 600)
        console.error(`${device}: ${role}`, { requests, dialogs, errors, visibleContent })
        throw error
    } finally {
        await context.close()
    }
}

async function main() {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(preview.hostname)) {
        throw new Error('Use uma URL de prévia local para o teste.')
    }
    if (screenshotRoot) await fs.mkdir(screenshotRoot, { recursive: true })
    for (const device of ['Pixel 7', 'iPhone 15 Pro']) {
        const useWebKit = device === 'iPhone 15 Pro' && process.env.MOBILE_TEST_WEBKIT === '1'
        const browser = useWebKit ? await webkit.launch() : await chromium.launch({ channel: process.env.MOBILE_BROWSER_CHANNEL || 'chrome' })
        try {
            for (const role of ['usuario', 'funcionario', 'admin']) await checkRole(browser, role, device)
        } finally {
            await browser.close()
        }
    }
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
