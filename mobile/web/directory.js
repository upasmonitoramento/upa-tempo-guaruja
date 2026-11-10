const known = [
    ['enseada|paulo flavio', 'UPA Enseada', 'Rua Luiz Rodrigues Pedro, 267 - Cidade Atlântica, Guarujá - SP', ['1333513661', '1333513629', '1333836495']],
    ['pereque', 'UPA Perequê', 'Estrada Guarujá-Bertioga, entre km 7 e 8 - Perequê, Guarujá - SP', ['1333536717']],
    ['rodoviaria|santamaria|matheus', 'UPA Rodoviária', 'Av. Santos Dumont, 856 - Santo Antônio, Guarujá - SP', ['13974105813']],
    ['vicente|pae cara|pae-cara', 'UPA Vicente de Carvalho', 'Av. São João, 111 - Pae-Cará, Guarujá - SP', ['1333425458', '1333426176', '1333411997']],
    ['santa cruz|navegantes', 'UPA Santa Cruz dos Navegantes', 'Rua Antônio Pinto Rodrigues, s/nº - Santa Cruz dos Navegantes, Guarujá - SP', ['1333542802']]
]
const plain = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
const keyName = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const knownUnit = value => known.findIndex(([pattern]) => new RegExp(pattern).test(keyName(value)))
const coordinate = (value, limit) => typeof value === 'number' && Math.abs(value) <= limit ? value : null

export function publicDirectory(data) {
    if (!Array.isArray(data)) throw new TypeError('Diretório inválido')
    const units = new Map()
    for (const item of data) {
        const id = plain(item?._id || item?.id, 100)
        const name = plain(item?.upa || item?.name, 160)
        if (!/^[\w-]+$/.test(id) || !name) continue
        const match = known[knownUnit(name)]
        units.set(id, {
            id,
            name: match?.[1] || name,
            address: plain(item.endereco || item.address, 300) || match?.[2] || '',
            lat: coordinate(item.lat, 90),
            lng: coordinate(item.lng, 180)
        })
    }
    if (data.length && !units.size) throw new TypeError('Nenhuma unidade válida')
    const order = unit => knownUnit(unit.name) < 0 ? known.length : knownUnit(unit.name)
    return [...units.values()].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'pt-BR'))
}

export function publicStats(data) {
    const results = new Map()
    for (const item of data) {
        const id = plain(item?._id || item?.id, 100)
        if (!/^[\w-]+$/.test(id)) continue
        const text = plain(item.tempo_espera, 80)
        const hours = text.match(/(\d+)\s*h/i)
        const minutes = text.match(/(\d+)\s*min/i)
        const numeric = item.tempo_minutos
        const wait = hours || minutes ? Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)
            : /^\d+$/.test(text) ? Number(text) : typeof numeric === 'number' ? numeric : NaN
        const valid = Number.isFinite(wait) && wait >= 0
        const team = Array.isArray(item.medicosPlantao) ? item.medicosPlantao : []
        const doctors = team.filter(person => plain(person?.nome, 120) && !/enfermagem/i.test(plain(person?.especialidade, 120))).length
        results.set(id, {
            wait: valid ? wait : null,
            status: !valid ? 'desconhecido' : wait <= 25 ? 'normal' : wait < 70 ? 'lotado' : 'critico',
            doctors
        })
    }
    return results
}

export const contacts = unit => known[knownUnit(unit.name)]?.[3] || []

export function mapLink(unit) {
    const target = unit.lat !== null && unit.lng !== null && (unit.lat !== 0 || unit.lng !== 0)
        ? `${unit.lat},${unit.lng}` : unit.address
    return target ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}` : null
}
