const AreaAds = require('../models/AreaAds')
const { entitled } = require('./partnerFunding')
let holidayCalendar, nationalCalendar
const positionMap = { card: 'card', detalhe: 'detalhe', rodape: 'rodape', banner: 'banner_inferior' }
const labels = { card: 'Cards das unidades', detalhe: 'Detalhes da unidade', rodape: 'Rodapé', banner: 'Banner' }
const defaults = { card: [260, 76, [11,12,13,14,15]], detalhe: [970, 180, [16]], rodape: [470, 160, [9,10]], banner: [970, 190, [17]] }
const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-')
function webURL(value) {
    if (typeof value !== 'string' || value.length > 2048) return false
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && Boolean(url.hostname) } catch { return false }
}
async function requirementsFor(positions) {
    const rows = await AreaAds.find({ status: 'ativo', posicao: { $in: positions.map(p => positionMap[p]) } }).select('codigo posicao larguraPx alturaPx').lean()
    const requirements = []
    for (const position of positions) {
        const matches = rows.filter(r => r.posicao === positionMap[position])
        const fallback = defaults[position]
        if (!fallback) throw Object.assign(new Error('Posição de publicidade indisponível.'), { status: 400 })
        const areas = matches.length ? matches : fallback[2].map(n => ({ codigo: 'ADS_' + String(n).padStart(2, '0'), larguraPx: fallback[0], alturaPx: fallback[1] }))
        for (const area of areas) {
            const width = Number(area.larguraPx), height = Number(area.alturaPx)
            if (!Number.isInteger(width) || !Number.isInteger(height) || width < 50 || height < 50 || width * height > 12000000) throw Object.assign(new Error('Revise as dimensões dos espaços de publicidade.'), { status: 409 })
            const key = position + '-' + width + 'x' + height
            let item = requirements.find(r => r.key === key)
            if (!item) { item = { key, position, label: labels[position], width, height, codes: [] }; requirements.push(item) }
            item.codes.push(area.codigo)
        }
    }
    if (requirements.length > 12) throw Object.assign(new Error('O pacote tem formatos demais. Simplifique as dimensões dos espaços.'), { status: 409 })
    return requirements
}
function publicationPeriod(days, now = new Date()) {
    if (!holidayCalendar) {
        const Holidays = require('date-holidays')
        nationalCalendar = new Holidays('BR')
        holidayCalendar = new Holidays('BR', 'SP')
        // Guarujá's public holidays; optional public-office closures are not business holidays.
        // Source: Diário Oficial, municipal calendar published 09/12/2025.
        holidayCalendar.setHoliday('01-15', { name: 'Santo Amaro', type: 'public' })
        holidayCalendar.setHoliday('easter -2', { name: 'Paixão de Cristo', type: 'public' })
        holidayCalendar.setHoliday('easter 60', { name: 'Corpus Christi', type: 'public' })
    }
    if (![14, 28].includes(days)) throw Object.assign(new Error('Escolha a duração de 14 ou 28 dias.'), { status: 409 })
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now)
    let cursor = new Date(day + 'T12:00:00-03:00')
    const additional = (process.env.PARTNER_BUSINESS_HOLIDAYS || '').split(',')
    for (let i = 0; i < 370; i++) {
        cursor = new Date(+cursor + 86400000)
        const iso = cursor.toISOString().slice(0, 10)
        // State overrides in upstream calendars must not remove a national holiday.
        const holidays = [...(nationalCalendar.isHoliday(cursor) || []), ...(holidayCalendar.isHoliday(cursor) || [])]
        if (![0, 6].includes(cursor.getUTCDay()) && !holidays.some(h => h.type === 'public') && !additional.includes(iso)) {
            const start = new Date(iso + 'T00:00:00-03:00')
            return { start, end: new Date(+start + days * 86400000) }
        }
    }
    throw new Error('Calendário de publicação indisponível')
}
function publicEligible(ad, city = 'guaruja', now = new Date()) {
    if (!ad || ad.status && ad.status !== 'ativo' || !ad.patrocinador || ad.patrocinador.status !== 'ativo' ||
        ad.dataInicio && new Date(ad.dataInicio) > now || ad.dataFim && new Date(ad.dataFim) <= now) return false
    if (ad.partnership) {
        const p = ad.partnership
        return entitled(p) && !p.portalPaused && p.publishedRevision === ad.publicationRevision && ad.cities?.includes(city)
    }
    // A deleted campaign must never turn into an unrestricted legacy advertisement.
    return ad.publicationRevision == null && city === 'guaruja'
}
module.exports = { slug, webURL, requirementsFor, positionMap, labels, publicationPeriod, publicEligible }
