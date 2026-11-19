const test = require('node:test')
const assert = require('node:assert/strict')
const sharp = require('sharp')
const media = require('../services/partnerMedia')
const { publicationPeriod, publicEligible } = require('../services/partnerRules')
test('artes são validadas, otimizadas e têm metadados privados removidos', async () => {
    const buffer = await sharp({ create: { width: 260, height: 76, channels: 3, background: '#1554b5' } }).withMetadata({ exif: { IFD0: { Artist: 'Private test metadata' } } }).jpeg().toBuffer()
    const file = { buffer, size: buffer.length, originalname: 'arte.jpg', mimetype: 'image/jpeg' }
    const result = await media.inspect(file, { width: 260, height: 76 })
    assert.equal(result.type, 'imagem'); assert.ok(result.thumbnail.length < 80000)
    const output = await sharp(file.buffer).metadata()
    assert.equal(output.format, 'webp'); assert.equal(output.exif, undefined)
    await assert.rejects(media.inspect({ buffer, originalname: 'arte.jpg', mimetype: 'image/jpeg' }, { width: 300, height: 300 }), /300 × 300/)
    await assert.rejects(media.inspect({ buffer: Buffer.from('<html>test</html>'), originalname: 'arte.png', mimetype: 'image/png' }, { width: 260, height: 76 }), /ler a imagem/)
})
test('vídeo real é identificado; duração, tamanho e dimensões fora da regra são rejeitados', async () => {
    const buffer = require('./partner-video.fixture')
    const file = () => ({ buffer: Buffer.from(buffer), size: buffer.length, originalname: 'arte.webm', mimetype: 'video/webm' })
    const result = await media.inspect(file(), { width: 260, height: 76 })
    assert.equal(result.type, 'video'); assert.equal(result.duration, 1)
    await assert.rejects(media.inspect(file(), { width: 970, height: 180 }), /970 × 180/)
    const tooLong = file(), offset = tooLong.buffer.indexOf(Buffer.from([0x44, 0x89, 0x88]))
    assert.ok(offset >= 0); tooLong.buffer.writeDoubleBE(16000, offset + 3)
    await assert.rejects(media.inspect(tooLong, { width: 260, height: 76 }), /15 segundos/)
    await assert.rejects(media.inspect({ ...file(), buffer: Buffer.alloc(4 * 1024 * 1024 + 1) }, { width: 260, height: 76 }), /4 MB/)
})
test('programação respeita feriado e fim de semana; duração é de 14 ou 28 dias', () => {
    const period = publicationPeriod(14, new Date('2026-11-19T15:00:00Z'))
    assert.equal(period.start.toISOString(), '2026-11-23T03:00:00.000Z')
    assert.equal(+period.end - +period.start, 14 * 86400000)
    assert.equal(publicationPeriod(14, new Date('2026-01-14T15:00:00Z')).start.toISOString(), '2026-01-16T03:00:00.000Z')
    assert.equal(publicationPeriod(14, new Date('2026-06-03T15:00:00Z')).start.toISOString(), '2026-06-05T03:00:00.000Z')
    assert.throws(() => publicationPeriod(15), /14 ou 28/)
})
test('anúncio exige revisão liberada, cidade, período e valor recebido', () => {
    const now = new Date('2026-11-18T15:00:00Z')
    const ad = { status: 'ativo', patrocinador: { status: 'ativo' }, publicationRevision: 2, cities: ['guaruja'], dataInicio: new Date('2026-11-17'), dataFim: new Date('2026-12-01'), partnership: { paymentStatus: 'RECEIVED', publishedRevision: 2, portalPaused: false } }
    assert.equal(publicEligible(ad, 'guaruja', now), true)
    for (const status of ['PENDING', 'CONFIRMED', 'REFUNDED']) assert.equal(publicEligible({ ...ad, partnership: { ...ad.partnership, paymentStatus: status } }, 'guaruja', now), false)
    assert.equal(publicEligible({ ...ad, partnership: { ...ad.partnership, publishedRevision: 1 } }, 'guaruja', now), false)
    assert.equal(publicEligible({ ...ad, partnership: null }, 'guaruja', now), false)
    assert.equal(publicEligible(ad, 'santos', now), false)
    assert.equal(publicEligible(ad, 'guaruja', new Date('2026-12-02')), false)
})


test('cortesia exige concessão explícita; revogação e campos falsos não liberam anúncios', async () => {
    const { entitled, validCourtesy, requireEntitlement } = require('../services/partnerFunding')
    const grant = { fundingType: 'courtesy', cents: 0, courtesySponsor: 'sponsor', courtesyGrantedBy: 'admin', courtesyGrantedAt: new Date() }
    assert.equal(validCourtesy(grant), true); assert.equal(entitled(grant), true)
    for (const change of [{ courtesyRevokedAt: new Date() }, { courtesyGrantedBy: null }, { courtesySponsor: null }, { cents: 500 }, { paymentId: 'fake-payment' }]) {
        assert.equal(entitled({ ...grant, ...change, paymentStatus: 'RECEIVED' }), false)
        await assert.rejects(requireEntitlement({ ...grant, ...change }), /cortesia/)
    }
    assert.equal(entitled({ fundingType: 'unexpected', paymentStatus: 'RECEIVED' }), false)
    const ad = { status: 'ativo', patrocinador: { status: 'ativo' }, cities: ['guaruja'], publicationRevision: 1, partnership: { ...grant, publishedRevision: 1 } }
    assert.equal(publicEligible(ad), true)
    assert.equal(publicEligible({ ...ad, partnership: { ...ad.partnership, courtesyRevokedAt: new Date() } }), false)
})
