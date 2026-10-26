// Exercise the actual worker with real Response streams and an isolated CacheStorage.
// Run: node --test scripts/verify-pwa-cache.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')

const origin = 'https://upa-tempo-guaruja.vercel.app'
const workerSource = fs.readFileSync(path.join(__dirname, '../frontend/sw.js'), 'utf8')

function worker() {
    const handlers = new Map()
    const stores = new Map()
    const fetches = []
    const writes = []
    const deleted = []
    let responseFactory = () => new Response('network page', { status: 200 })
    let openDelay = 0
    let skipWaiting = false
    let claimed = false
    const keyOf = request => new URL(typeof request === 'string' ? request : request.url, origin).href
    const ensureStore = name => {
        if (!stores.has(name)) stores.set(name, new Map())
        return stores.get(name)
    }
    const cacheFor = name => ({
        async addAll(urls) {
            for (const url of urls) {
                writes.push({ operation: 'addAll', name, url })
                ensureStore(name).set(keyOf(url), new Response(`shell ${url}`))
            }
        },
        async put(request, response) {
            writes.push({ operation: 'put', name, url: typeof request === 'string' ? request : request.url })
            ensureStore(name).set(keyOf(request), response.clone())
        },
    })
    const caches = {
        async open(name) {
            if (openDelay) await new Promise(resolve => setTimeout(resolve, openDelay))
            ensureStore(name)
            return cacheFor(name)
        },
        async keys() { return [...stores.keys()] },
        async delete(name) {
            deleted.push(name)
            return stores.delete(name)
        },
        async match(request) {
            for (const store of stores.values()) {
                const value = store.get(keyOf(request))
                if (value) return value.clone()
            }
        },
    }
    const context = vm.createContext({
        URL, Response,
        caches,
        fetch: async (request, options) => {
            fetches.push({ url: request.url || request, options })
            return responseFactory(request, options)
        },
        self: {
            location: { origin },
            addEventListener: (type, handler) => handlers.set(type, handler),
            skipWaiting: async () => { skipWaiting = true },
            clients: { claim: async () => { claimed = true } },
        },
    })
    vm.runInContext(workerSource, context, { filename: 'frontend/sw.js' })
    const cacheName = vm.runInContext('CACHE_NAME', context)
    const shell = Array.from(vm.runInContext('SHELL', context))

    function dispatch(type, request) {
        const pending = []
        let response
        handlers.get(type)({
            request,
            waitUntil(promise) {
                // Catch immediately, but retain the original promise for assertions.
                promise.catch(() => {})
                pending.push(promise)
            },
            respondWith(promise) { response = Promise.resolve(promise) },
        })
        return {
            get response() { return response },
            async complete() {
                let position = 0
                while (position < pending.length) await pending[position++]
            },
        }
    }

    return {
        cacheName, shell, stores, fetches, writes, deleted,
        dispatch,
        async install() { await dispatch('install').complete() },
        async activate() { await dispatch('activate').complete() },
        fetch(url, options = {}) {
            return dispatch('fetch', { url: new URL(url, origin).href, method: 'GET', mode: 'cors', ...options })
        },
        setNetwork(factory) { responseFactory = factory },
        setOpenDelay(ms) { openDelay = ms },
        seed(name, url, body = 'cached page') { ensureStore(name).set(keyOf(url), new Response(body)) },
        async cached(url, name = cacheName) {
            const response = stores.get(name)?.get(keyOf(url))
            return response ? response.clone().text() : undefined
        },
        state() { return { skipWaiting, claimed } },
    }
}

test('install downloads only the compact app shell, excluding photos and API data', async () => {
    const w = worker()
    await w.install()
    assert.deepEqual(w.writes.map(write => write.url), w.shell)
    assert.ok(w.shell.includes('/index.html'))
    assert.ok(w.shell.length <= 12, 'avoid expanding the install into a large offline download')
    for (const url of w.shell) {
        assert.ok(!/^\/(auth|atendimento|admin|patrocinadores|anuncios|areas-ads|api|images)(\/|$)/.test(url))
        assert.ok(!/\.(jpe?g|webp|avif|mp4)(\?|$)/i.test(url), `unexpected photo/video in shell: ${url}`)
    }
    assert.equal(w.state().skipWaiting, true)
})

test('activation removes old Saúde caches while retaining unrelated app caches', async () => {
    const w = worker()
    w.seed('saude-guaruja-v1', '/old.html')
    w.seed('saude-guaruja-v7', '/old-2.html')
    w.seed(w.cacheName, '/index.html')
    w.seed('other-site-v2', '/other.html')
    w.seed('saude-unrelated-app', '/other-app.html')
    await w.activate()
    assert.deepEqual(w.deleted.sort(), ['saude-guaruja-v1', 'saude-guaruja-v7'])
    assert.ok(w.stores.has(w.cacheName))
    assert.ok(w.stores.has('other-site-v2'))
    assert.ok(w.stores.has('saude-unrelated-app'))
    assert.equal(w.state().claimed, true)
})

test('API, advertisements, authentication and unit images always use no-store and never enter caches', async () => {
    const w = worker()
    await w.install()
    const writesBefore = w.writes.length
    const routes = ['/auth/me', '/atendimento', '/atendimento/123', '/admin/users', '/patrocinadores', '/anuncios?slot=1', '/areas-ads', '/api/report', '/images/unit-example-480.webp', '/images/units.json']
    for (const route of routes) {
        w.seed(w.cacheName, route, 'stale data must not be returned')
        const event = w.fetch(route)
        assert.equal(await (await event.response).text(), 'network page')
        await event.complete()
        assert.equal(w.fetches.at(-1).options?.cache, 'no-store', route)
    }
    assert.equal(w.fetches.length, routes.length)
    assert.equal(w.writes.length, writesBefore)
    w.setNetwork(() => { throw new Error('offline') })
    await assert.rejects(w.fetch('/atendimento').response, /offline/)
    await assert.rejects(w.fetch('/images/unit-example-480.webp').response, /offline/)
})

test('the worker leaves writes, third-party hosts, and non-shell resources to the browser', async () => {
    const w = worker()
    for (const [url, options] of [
        ['/atendimento', { method: 'POST' }],
        ['https://tile.openstreetmap.org/1/1/1.png', {}],
        ['/logo-saude.png', {}],
        ['/unlisted-script.js', {}],
        ['/experience.css?v=other', {}],
    ]) assert.equal(w.fetch(url, options).response, undefined, url)
    assert.equal(w.fetches.length, 0)
    assert.equal(w.writes.length, 0)
})

test('only listed shell assets revalidate online and keep fixed keys for their offline fallback', async () => {
    const w = worker()
    await w.install()
    const keysBefore = [...w.stores.get(w.cacheName).keys()].sort()
    for (const url of w.shell) {
        const event = w.fetch(url)
        assert.equal(await (await event.response).text(), 'network page')
        await event.complete()
        assert.equal(w.fetches.at(-1).options?.cache, 'no-cache', url)
    }
    assert.equal(w.fetches.length, w.shell.length)
    assert.deepEqual([...w.stores.get(w.cacheName).keys()].sort(), keysBefore)
    w.setNetwork(() => { throw new Error('offline') })
    for (const url of w.shell) {
        const event = w.fetch(url)
        assert.equal(await (await event.response).text(), 'network page')
        await event.complete()
    }
    const writesBefore = w.writes.length
    w.setNetwork(() => new Response('server unavailable', { status: 503 }))
    const unavailable = w.fetch('/public-ui.js?v=1')
    assert.equal((await unavailable.response).status, 503)
    await unavailable.complete()
    assert.equal(w.writes.length, writesBefore)
    assert.equal(await w.cached('/public-ui.js?v=1'), 'network page')
    w.stores.get(w.cacheName).delete(new URL('/public-ui.js?v=1', origin).href)
    w.setNetwork(() => new Response('restored script'))
    const event = w.fetch('/public-ui.js?v=1')
    assert.equal(await (await event.response).text(), 'restored script')
    await event.complete()
    assert.equal(await w.cached('/public-ui.js?v=1'), 'restored script')
    assert.deepEqual([...w.stores.get(w.cacheName).keys()].sort(), keysBefore)
})

test('offline navigation uses the installed shell, without persisting requested pages', async () => {
    const w = worker()
    await w.install()
    const writesBefore = w.writes.length
    w.setNetwork(() => { throw new Error('offline') })
    for (const url of ['/', '/index.html', '/unidade/123', '/?unit=123']) {
        const event = w.fetch(url, { mode: 'navigate' })
        assert.equal(await (await event.response).text(), 'shell /index.html')
        await event.complete()
    }
    assert.equal(w.writes.length, writesBefore)
})

test('online navigation updates only one shell key and never accumulates query or detail pages', async () => {
    const w = worker()
    await w.install()
    const keysBefore = [...w.stores.get(w.cacheName).keys()].sort()
    for (let i = 0; i < 25; i++) {
        for (const url of [`/?unit=${i}`, `/unidade/${i}`]) {
            const event = w.fetch(url, { mode: 'navigate' })
            assert.equal(await (await event.response).text(), 'network page')
            await event.complete()
        }
    }
    assert.deepEqual([...w.stores.get(w.cacheName).keys()].sort(), keysBefore)
    assert.ok(w.writes.filter(write => write.operation === 'put').every(write => write.url === '/index.html'))
    const writesBefore = w.writes.length
    w.setNetwork(() => new Response('server unavailable', { status: 503 }))
    const event = w.fetch('/', { mode: 'navigate' })
    assert.equal((await event.response).status, 503)
    await event.complete()
    assert.equal(w.writes.length, writesBefore)
    assert.equal(await w.cached('/index.html'), 'network page')
})

test('navigation cache refresh survives body consumption before asynchronous CacheStorage opens', async () => {
    const w = worker()
    await w.install()
    w.setOpenDelay(15)
    w.setNetwork(() => new Response('new production page'))
    const event = w.fetch('/', { mode: 'navigate' })
    const response = await event.response
    assert.equal(await response.text(), 'new production page')
    await event.complete()
    assert.equal(await w.cached('/index.html'), 'new production page')
})

test('shell asset refresh also clones its stream before asynchronous CacheStorage opens', async () => {
    const w = worker()
    await w.install()
    w.setOpenDelay(15)
    w.setNetwork(() => new Response('new version of script'))
    const event = w.fetch('/public-ui.js?v=1')
    assert.equal(await (await event.response).text(), 'new version of script')
    await event.complete()
    assert.equal(await w.cached('/public-ui.js?v=1'), 'new version of script')
})
