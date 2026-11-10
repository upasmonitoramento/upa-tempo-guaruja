function httpsURL(value, name) {
    if (!value) throw new Error('Variável ausente: ' + name)
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('URL HTTPS sem credenciais exigida: ' + name)
    return url
}
async function get(url, headers = {}) {
    const response = await fetch(url, {headers, credentials:'omit', signal:AbortSignal.timeout(12000)})
    if (!response.ok) throw new Error(url.hostname + ' respondeu HTTP ' + response.status)
    if (!response.url.startsWith('https://')) throw new Error('Redirecionamento não HTTPS')
    return response
}
async function main() {
    const api = httpsURL(process.env.MOBILE_API_ORIGIN || 'https://upa-tempo-guaruja.vercel.app', 'MOBILE_API_ORIGIN')
    if (api.href !== api.origin + '/') throw new Error('MOBILE_API_ORIGIN deve ser uma origem sem caminho.')
    const links = process.argv.includes('--release') ? [
        ['MOBILE_PRIVACY_URL', 'Política de privacidade'],
        ['MOBILE_SUPPORT_URL', 'Suporte']
    ].map(([key, label]) => [httpsURL(process.env[key], key), label]) : []
    for (const origin of ['https://localhost', 'capacitor://localhost']) {
        const response = await get(new URL('/atendimento', api), {Origin:origin})
        const allowed = response.headers.get('access-control-allow-origin')
        if (allowed !== '*' && allowed !== origin) throw new Error('A API não permite a origem nativa ' + origin)
        const items = await response.json()
        if (!Array.isArray(items) || !items.length || items.some(item => !(item?._id || item?.id) || !(item?.upa || item?.name))) throw new Error('O diretório retornou formato inesperado ou vazio.')
        console.log('API validada para ' + origin + ': ' + items.length + ' unidades.')
    }
    for (const [url, label] of links) {
        const response = await get(url)
        if (!response.headers.get('content-type')?.includes('text/html')) throw new Error(label + ' precisa ser uma página pública HTML.')
        const html = await response.text()
        if (!html.includes('Saúde Guarujá') || /\{\{\w+\}\}/.test(html)) throw new Error(label + ' não parece conter a página final do app.')
        console.log(label + ': acessível em HTTPS.')
    }
}
main().catch(error => {
    console.error(error.cause?.code ? 'Conexão HTTPS não verificada: ' + error.cause.code : error.message)
    process.exitCode = 1
})
