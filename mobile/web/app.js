import { publicDirectory, publicStats, contacts, mapLink } from './directory.js'

const config = globalThis.SAUDE_CONFIG
const byId = id => document.getElementById(id)
const cards = byId('cards')
const favoritesKey = 'saude:favorite-unit-ids:v1'
const directoryKey = 'saude:public-directory:v1'
const getLocal = key => {
    try { return JSON.parse(localStorage.getItem(key)) }
    catch { return null }
}
const setLocal = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true }
    catch { return false }
}
const storedFavorites = getLocal(favoritesKey)
const favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites.filter(id => typeof id === 'string') : [])
const photos = new Map(config.directory.map(unit => [unit.id, unit.photos]))
let units
try { units = publicDirectory(getLocal(directoryKey) ?? config.directory) }
catch { units = publicDirectory(config.directory) }
let stats = new Map()
let favoriteOnly = false
let filter = null
let phase = 'loading'
let request
let lastRefresh = 0

function element(tag, text, className) {
    const result = document.createElement(tag)
    if (text) result.textContent = text
    if (className) result.className = className
    return result
}
function button(text, action, className = '') {
    const result = element('button', text, className)
    result.type = 'button'
    result.addEventListener('click', action)
    return result
}
function external(text, href) {
    const result = element('a', text, 'link')
    result.href = href
    result.target = '_blank'
    result.rel = 'noopener noreferrer'
    return result
}
function showFavorite(unit, control) {
    const selected = favorites.has(unit.id)
    control.textContent = selected ? '★ Favorita' : '☆ Favoritar'
    control.setAttribute('aria-pressed', String(selected))
    control.setAttribute('aria-label', `${selected ? 'Remover dos favoritos' : 'Favoritar'}: ${unit.name}`)
}
function favoriteButton(unit) {
    const control = button('', () => {
        if (favorites.has(unit.id)) favorites.delete(unit.id)
        else favorites.add(unit.id)
        const saved = setLocal(favoritesKey, [...favorites])
        showFavorite(unit, control)
        byId('announcement').textContent = saved
            ? favorites.has(unit.id) ? `${unit.name} adicionada às favoritas.` : `${unit.name} removida das favoritas.`
            : 'A preferência vale só nesta sessão. O aparelho não permitiu salvá-la.'
        if (favoriteOnly && !selectedUnit()) {
            render()
            byId('favorites').focus()
        }
    }, 'favorite-button')
    showFavorite(unit, control)
    return control
}
function addPhoto(container, unit, first) {
    const variants = photos.get(unit.id)
    if (!variants?.length) return
    const image = element('img', '', 'unit-photo')
    image.alt = `Fachada de ${unit.name}`
    image.src = variants[0].src
    image.srcset = variants.map(photo => `${photo.src} ${photo.width}w`).join(', ')
    image.sizes = '(min-width: 720px) 50vw, 100vw'
    image.width = 480
    image.height = 320
    image.loading = first ? 'eager' : 'lazy'
    image.decoding = 'async'
    image.addEventListener('error', () => image.remove(), { once: true })
    container.append(image)
}
function label(text, value) {
    const group = element('div', '', 'metric')
    group.append(element('small', text), element('strong', value))
    return group
}
function metrics(unit) {
    const summary = element('div', '', 'metrics')
    const record = stats.get(unit.id)
    summary.append(label('Espera de exemplo', record?.wait != null ? `${record.wait} min` : 'Não informada'),
        label('Equipe de exemplo', record?.doctors ? `${record.doctors} ${record.doctors === 1 ? 'médico' : 'médicos'}` : 'Não informada'))
    return summary
}
function unitCard(unit, first) {
    const card = element('article', '', 'unit-card')
    const media = element('div', '', 'unit-media')
    addPhoto(media, unit, first)
    const record = stats.get(unit.id)
    if (record?.wait != null) {
        const ranges = { normal: 'Até 25 min', lotado: '26 a 69 min', critico: '70 min ou mais' }
        media.append(element('span', ranges[record.status], 'status-badge status-' + record.status))
    }
    card.append(media)
    const content = element('div', '', 'unit-card-content')
    const heading = element('h2', unit.name)
    const actions = element('div', '', 'actions')
    actions.append(button('Ver detalhes', () => { location.hash = 'upa/' + unit.id }, 'primary'), favoriteButton(unit))
    content.append(element('p', 'UNIDADE DE ATENDIMENTO', 'kicker'), heading, metrics(unit), actions)
    card.append(content)
    return card
}
function selectedUnit() {
    const id = location.hash.startsWith('#upa/') ? location.hash.slice(5) : ''
    return units.find(unit => unit.id === id)
}
function details(unit) {
    const card = element('article', '', 'unit-card detail')
    addPhoto(card, unit, true)
    const content = element('div', '', 'unit-card-content')
    content.append(element('p', 'Demonstração · tempos e equipes de exemplo', 'kicker'), element('h1', unit.name))
    if (unit.address) content.append(element('p', unit.address))
    content.append(metrics(unit), label('Pessoas aguardando', 'Não informado'))
    const actions = element('div', '', 'actions')
    const route = mapLink(unit)
    if (route) actions.append(external('Abrir rota externa', route))
    actions.append(favoriteButton(unit))
    content.append(actions)
    for (const number of contacts(unit)) {
        const dial = element('a', 'Ligar: ' + number.replace(/^(\d{2})(\d+)(\d{4})$/, '($1) $2-$3'), 'link')
        dial.href = 'tel:+55' + number
        content.append(dial)
    }
    content.append(element('p', 'Confirme os dados diretamente com a unidade.', 'muted'))
    card.append(content)
    return card
}
function render() {
    const detail = selectedUnit()
    byId('overview').hidden = Boolean(detail)
    byId('home').setAttribute('aria-pressed', String(!favoriteOnly))
    byId('favorites').setAttribute('aria-pressed', String(favoriteOnly))
    const currentFilter = document.querySelector(`[data-filter="${filter}"]`)
    byId('active-filter').hidden = !currentFilter
    byId('active-filter').textContent = currentFilter?.getAttribute('aria-label') || ''
    byId('reset').hidden = !currentFilter
    for (const control of document.querySelectorAll('[data-filter]')) {
        control.setAttribute('aria-pressed', String(control === currentFilter))
        control.disabled = phase !== 'online'
    }
    const strip = byId('chips')
    strip.replaceChildren(...units.map(unit => button(unit.name.replace(/^UPA /, ''), () => { location.hash = 'upa/' + unit.id })))
    strip.hidden = !units.length
    if (detail) {
        cards.classList.add('detail-grid')
        cards.replaceChildren(button('← Voltar às unidades', () => { location.hash = '' }, 'back'), details(detail))
    } else {
        cards.classList.remove('detail-grid')
        const visible = units.filter(unit => (!favoriteOnly || favorites.has(unit.id)) && (!filter || stats.get(unit.id)?.status === filter))
        const empty = favoriteOnly ? 'Nenhuma unidade favorita neste filtro.' : filter ? 'Nenhuma unidade nesta faixa.' : 'Nenhuma unidade disponível.'
        cards.replaceChildren(...(visible.length ? visible.map(unitCard) : [element('p', empty, 'empty')]))
    }
    byId('connection').hidden = phase === 'online'
    byId('retry').hidden = phase === 'loading'
    byId('connection-text').textContent = phase === 'loading' ? 'Buscando dados de exemplo…'
        : phase === 'unavailable' ? 'Sem atualização do servidor. O diretório continua disponível; os tempos de espera foram ocultados.' : ''
}
function showList(onlyFavorites) {
    favoriteOnly = onlyFavorites
    filter = null
    if (location.hash) location.hash = ''
    render()
    byId('main').focus()
}
async function refresh() {
    request?.abort()
    const controller = request = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    phase = 'loading'
    stats = new Map()
    filter = null
    render()
    try {
        const response = await fetch(config.apiOrigin + '/atendimento', { credentials: 'omit', cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Serviço indisponível')
        const data = await response.json()
        const next = publicDirectory(data)
        const nextStats = publicStats(data)
        if (request !== controller) return
        units = next
        stats = nextStats
        setLocal(directoryKey, units)
        phase = 'online'
        lastRefresh = Date.now()
    } catch {
        if (request !== controller) return
        phase = 'unavailable'
    } finally {
        clearTimeout(timeout)
        if (request === controller) {
            request = null
            render()
        }
    }
}

byId('home').addEventListener('click', () => showList(false))
byId('favorites').addEventListener('click', () => showList(true))
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); showList(false) })
byId('retry').addEventListener('click', refresh)
byId('reset').addEventListener('click', () => { filter = null; render(); byId('title').focus() })
byId('title').tabIndex = -1
for (const control of document.querySelectorAll('[data-filter]')) {
    control.addEventListener('click', () => { filter = filter === control.dataset.filter ? null : control.dataset.filter; render() })
}
window.addEventListener('hashchange', () => { render(); byId('main').focus(); window.scrollTo(0, 0) })
window.addEventListener('online', refresh)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !request && Date.now() - lastRefresh > 60000) refresh()
})
window.addEventListener('offline', () => {
    request?.abort()
    request = null
    stats = new Map()
    filter = null
    phase = 'unavailable'
    render()
})
for (const [text, url] of [['Site do projeto', config.siteOrigin], ['Privacidade', config.privacyUrl], ['Suporte', config.supportUrl]]) {
    if (url) byId('information').append(external(text, url))
}
byId('preview-note').hidden = config.release
refresh()
