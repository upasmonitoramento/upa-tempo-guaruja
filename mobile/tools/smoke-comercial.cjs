// Run with the mobile preview on localhost:3199 and playwright-core on NODE_PATH.
const assert = require('node:assert/strict')
const { chromium, devices } = require('playwright-core')
const path = require('node:path')
const fs = require('node:fs/promises')
const base = 'http://127.0.0.1:3199'
const date = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const proposal = (id, company, status, offset = 0) => ({
    _id: id, company, email: `${company.toLowerCase()}@example.test`, packageName: 'Regional',
    cents: 25000, cities: ['Guarujá'], positions: ['card'], start: date(-3), end: date(20), due: date(1),
    paymentStatus: status, accepted: date(-1), createdAt: date(offset), representative: 'Responsável de exemplo'
})
async function main() {
    const browser = await chromium.launch({ channel: 'chrome' })
    try {
        for (const viewport of [{ ...devices['iPhone 15 Pro'], name: 'iphone' }, { viewport: { width: 1440, height: 1000 }, name: 'desktop' }]) {
            const context = await browser.newContext({ ...viewport, serviceWorkers: 'block', reducedMotion: 'reduce' })
            const page = await context.newPage()
            const errors = []
            page.on('pageerror', error => errors.push(error.message))
            let requests = 0
            await context.route('**/*', route => {
                const url = new URL(route.request().url())
                if (url.origin === base) return route.continue()
                const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Portal-Commercial-Mode', 'X-Portal-Commercial-Mode': 'preparation' }
                if (url.pathname === '/comercial/painel') {
                    requests++
                    return route.fulfill({ headers, json: [proposal('1', 'Parceiro', 'RECEIVED'), proposal('2', 'Pendente', 'PENDING', -10), proposal('3', 'Parceiro', 'REFUNDED', -9)] })
                }
                return route.fulfill({ headers, json: [] })
            })
            await page.goto(base)
            await page.evaluate(() => window.abrirComercial())
            const panel = page.getByRole('dialog', { name: 'Gestão de publicidade' })
            await panel.getByRole('heading', { name: 'Visão geral' }).waitFor()
            await panel.getByText('Painel em preparação.', { exact: false }).waitFor()
            assert.equal(await panel.getByRole('button', { name: 'Nova proposta', exact: true }).isDisabled(), true)
            await panel.locator('[data-filter-link="recebidas"]').click()
            assert.equal(await panel.locator('[data-company]').count(), 1)
            await panel.locator('[data-company]').click()
            await panel.getByRole('heading', { name: 'Histórico de propostas' }).waitFor()
            assert.equal(await panel.locator('.commercial-contracts article').count(), 2)
            assert.equal(await panel.locator('[data-pix]:enabled').count(), 0)
            await panel.locator('[data-back]').click()
            await panel.getByRole('button', { name: 'Todas', exact: true }).click()
            await panel.getByLabel('Buscar parceria').fill('Pendente')
            assert.equal(await panel.locator('[data-company]').count(), 1)
            await panel.getByLabel('Buscar parceria').fill('inexistente')
            await panel.getByRole('heading', { name: 'Nenhuma parceria encontrada' }).waitFor()
            assert.equal(requests, 1, 'Local filters must not refetch data')
            await panel.getByRole('button', { name: 'Atualizar dados' }).click()
            await page.waitForFunction(() => !document.querySelector('.commercial-top button:last-child').disabled)
            assert.equal(requests, 2)
            await panel.locator('[data-tab="resumo"]').click()
            const geometry = await panel.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, height: element.clientHeight, screen: innerHeight }))
            assert.ok(geometry.scroll <= geometry.width + 1, 'Dashboard must not overflow horizontally')
            assert.ok(Math.abs(geometry.height - geometry.screen) < 2, 'Dashboard should fill the screen')
            const folder = path.resolve(__dirname, '../../..', 'tmp', 'admin-review')
            await fs.mkdir(folder, { recursive: true })
            await panel.screenshot({ path: path.join(folder, `${viewport.name}-publicidade.png`) })
            await panel.getByRole('button', { name: 'Voltar ao Portal' }).click()
            assert.equal(await page.locator('dialog[open]').count(), 0)
            assert.deepEqual(errors, [])
            console.log(`${viewport.name}: commercial filters, profile, read-only mode and layout OK`)
            await context.close()
        }
    } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
