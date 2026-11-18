const path = require('node:path')
const Anuncio = require('../models/Anuncio')
const r2 = require('../config/r2')
const fail = message => { throw Object.assign(new Error(message), { status: 422 }) }
async function inspect(file, requirement) {
    const ext = path.extname(file.originalname).toLowerCase()
    const allowed = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm' }
    if (allowed[ext] !== file.mimetype || !file.buffer?.length) fail('Use JPG, PNG, WEBP, MP4 ou WEBM com o tipo correto.')
    if (file.buffer.length > 4 * 1024 * 1024) fail('O arquivo deve ter até 4 MB.')
    if (!file.mimetype.startsWith('video/')) {
        try {
            const sharp = require('sharp')
            const { imageSize } = require('image-size')
            const data = imageSize(file.buffer)
            const expected = { '.jpg': 'jpg', '.jpeg': 'jpg', '.png': 'png', '.webp': 'webp' }[ext]
            if (data.type !== expected) fail('O conteúdo da imagem não corresponde ao formato informado.')
            const converted = await sharp(file.buffer, { limitInputPixels: 12000000, animated: false }).rotate().webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
            if (converted.info.width !== requirement.width || converted.info.height !== requirement.height) fail(`Este formato exige ${requirement.width} × ${requirement.height} pixels. Ajuste a arte e envie novamente.`)
            if (converted.data.length > 4 * 1024 * 1024) fail('A imagem final ficou muito grande. Simplifique a arte.')
            const thumbnail = await sharp(converted.data).resize({ width: 320, height: 160, fit: 'inside', withoutEnlargement: true }).webp({ quality: 65 }).toBuffer()
            file.buffer = converted.data; file.originalname = 'arte.webp'; file.mimetype = 'image/webp'
            return { type: 'imagem', width: converted.info.width, height: converted.info.height, thumbnail }
        } catch (error) {
            if (error.status) throw error
            fail('Não foi possível ler a imagem. Exporte novamente em JPG, PNG ou WEBP.')
        }
    }
    const mp4 = file.buffer.subarray(4, 8).toString() === 'ftyp'
    const webm = file.buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    if (ext === '.mp4' ? !mp4 : !webm) fail('O conteúdo do vídeo não corresponde ao formato informado.')
    let metadata
    try { metadata = await (await import('music-metadata')).parseBuffer(file.buffer, { mimeType: file.mimetype, size: file.size }, { duration: true, skipCovers: true }) }
    catch { fail('Não foi possível ler o vídeo. Exporte novamente em MP4 H.264 ou WebM VP8/VP9.') }
    const track = metadata.format.trackInfo?.find(t => t.video)
    const width = track?.video.pixelWidth || track?.video.displayWidth
    const height = track?.video.pixelHeight || track?.video.displayHeight
    const duration = metadata.format.duration || track?.duration
    if (!(duration > 0 && duration <= 15.1)) fail('O vídeo deve ter no máximo 15 segundos e duração identificável.')
    if (width !== requirement.width || height !== requirement.height) fail(`O vídeo exige ${requirement.width} × ${requirement.height} pixels.`)
    if (!/^(avc1|avc3|V_VP8|V_VP9|vp08|vp09)$/i.test(track.codecId || '')) fail('Use MP4 H.264 ou WebM VP8/VP9 para funcionar nos celulares.')
    return { type: 'video', width, height, duration: Math.round(duration * 1000) / 1000 }
}
async function cleanupDraft(p, asset) {
    const inUse = await Anuncio.exists({ partnership: p._id, publicationRevision: p.publishedRevision, midia: asset.url, status: { $ne: 'removido' } })
    if (inUse) return
    for (const key of [asset.storageKey, asset.thumbnailKey].filter(Boolean)) {
        try { await r2.deletePartnerAsset(key) } catch (error) { console.error('Limpeza de arte substituída:', error.name) }
    }
}
module.exports = { inspect, cleanupDraft }
