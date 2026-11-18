const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { S3Client } = require('@aws-sdk/client-s3')
const { uploadFotoPerfil, uploadMidiaAnuncio } = require('../middlewares/uploadSeguro')

test('uploads respeitam formato/tamanho e enviam somente arquivos aceitos ao R2', async t => {
    Object.assign(process.env, { R2_BUCKET_NAME: 'test-bucket', R2_ENDPOINT: 'https://test.invalid', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test', R2_PUBLIC_URL: 'https://media.example.test' })
    let uploads = 0
    t.mock.method(S3Client.prototype, 'send', async command => {
        assert.equal(command.input.Bucket, 'test-bucket')
        assert.ok(command.input.Body.length > 0)
        uploads++
        return {}
    })
    const app = express()
    app.post('/perfil', uploadFotoPerfil, (req, res) => res.json({ url: req.file.filename }))
    app.post('/midia', uploadMidiaAnuncio, (req, res) => res.json({ url: req.file.filename }))
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const base = `http://127.0.0.1:${server.address().port}`
    async function send(path, field, name, type, bytes) {
        const form = new FormData()
        form.append(field, new Blob([bytes], { type }), name)
        return fetch(base + path, { method: 'POST', body: form })
    }
    assert.equal((await send('/perfil', 'foto', 'foto.html', 'text/html', '<script>test</script>')).status, 400)
    assert.equal((await send('/perfil', 'foto', 'foto.jpg', 'image/jpeg', new Uint8Array(2 * 1024 * 1024 + 1))).status, 400)
    assert.equal((await send('/midia', 'midia', 'video.mp4', 'video/mp4', new Uint8Array(4 * 1024 * 1024 + 1))).status, 400)
    assert.equal(uploads, 0)
    const response = await send('/perfil', 'foto', 'foto.png', 'image/png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3eoAAAAASUVORK5CYII=', 'base64'))
    assert.equal(response.status, 200)
    assert.match((await response.json()).url, /^https:\/\/media\.example\.test\/perfis\//)
    assert.equal(uploads, 1)
})
