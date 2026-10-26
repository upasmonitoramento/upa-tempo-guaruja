/* Interface pública: sem dependências de animação e sem dados de pacientes. */
var portalPhotoAssets = []
var portalAdStates = new Map()
var portalMapLoading = null
var portalReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
var portalSaveData = Boolean(navigator.connection && navigator.connection.saveData)
var portalAdObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
        const state = portalAdStates.get(entry.target)
        if (!state) return
        state.visible = entry.isIntersecting
        atualizarAnuncioVisivel(state)
    })
}, { rootMargin: '0px' }) : null

function portalIcon(name) {
    const paths = {
        arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        back: '<path d="m14 6-6 6 6 6"/>',
        pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        team: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
        map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>'
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`
}

function portalScrollTop() {
    window.scrollTo({ top: 0, behavior: portalReducedMotion.matches ? 'instant' : 'smooth' })
}

function portalTempo(u) {
    const text = String(u.tempo_espera || '').trim()
    if (text && text !== '-') return text
    return Number.isFinite(u.tempo_minutos) ? (u.tempo_minutos === 0 ? '0 min' : formatarTempo(u.tempo_minutos)) : 'Não informado'
}

function minutosDaUnidade(u) {
    if (!u) return NaN
    const text = String(u.tempo_espera || '').trim()
    const hours = text.match(/(\d+)\s*h/i)
    const minutes = text.match(/(\d+)\s*min/i)
    if (hours || minutes) return Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)
    if (typeof u.tempo_minutos === 'number' && Number.isFinite(u.tempo_minutos)) return u.tempo_minutos
    return /^\d+$/.test(text) ? Number(text) : NaN
}

function portalMedicos(u) {
    return medicosDaUnidade(u).filter(m => m.nome && !/enfermagem/i.test(m.especialidade || ''))
}

function portalAtualizacao(u) {
    const date = new Date(u.observadoEm || u.data || u.updatedAt || '')
    if (!Number.isFinite(date.getTime())) return 'Data não informada'
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' · ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function portalPhoto(u, first = false, detail = false) {
    const asset = portalPhotoAssets.find(item => item.id === u._id && item.originalURL === u.foto)
    const fallback = fotoUnidade(u)
    const src = asset ? asset.variants[detail ? asset.variants.length - 1 : 0].url : fallback
    const srcset = asset ? `srcset="${asset.variants.map(v => `${escapeHTML(v.url)} ${v.width}w`).join(', ')}" sizes="${detail ? '(min-width: 900px) 42vw, 100vw' : '(min-width: 1200px) 320px, (min-width: 640px) 45vw, 100vw'}"` : ''
    return `<img class="unit-card-photo" src="${escapeHTML(src)}" ${srcset} alt="Fachada de ${escapeHTML(nomeCurtoUPA(u))}" width="960" height="640" loading="${first || detail ? 'eager' : 'lazy'}" decoding="async" ${first ? 'fetchpriority="high"' : ''} onerror="this.onerror=null;this.removeAttribute('srcset');this.src='/images/unit-placeholder.svg'">`
}

function portalAdSlot(id, number, className = '') {
    return `<div id="${id}" class="ads-slot vazio ${className}"><div class="ads-placeholder"><span class="ads-numero-slot">${number}</span></div></div>`
}

function carregarLista() {
    limparTimersAds()
    const selected = filtroAtendimentoAtual || 'todos'
    const filtered = ordenarUnidades(selected === 'todos' ? unidades : unidades.filter(u => statusDaUnidade(u) === selected))
    renderizarBarraUpasMobile()
    const filters = [['todos', 'Todas'], ['normal', 'Até 25 min'], ['lotado', '26–69 min'], ['critico', '70 min ou mais']]
    document.getElementById('lista').innerHTML = `
        <div class="page-shell">
            <div class="demo-notice" role="note"><span class="demo-dot"></span><div><strong>Projeto em demonstração</strong><span>Tempos e equipes são exemplos. Não representam o atendimento atual.</span></div></div>
            <div class="health-layout">
                <aside class="ads-side ads-lateral-coluna" aria-label="Publicidade lateral esquerda">${[1,2,3,4].map((n,i) => portalAdSlot(`adLateralEsquerda${i+1}`, n, 'ads-slot-lateral-pequeno')).join('')}</aside>
                <section class="health-main" aria-labelledby="unidadesTitulo">
                    <div class="section-heading"><div><p class="section-kicker">EXPLORE A REDE</p><h1 id="unidadesTitulo" class="section-title" tabindex="-1">Encontre uma unidade</h1><p class="section-copy">Informações essenciais. Detalhes a um toque.</p></div><span class="section-count">${filtered.length} ${filtered.length === 1 ? 'unidade' : 'unidades'}</span></div>
                    <div class="wait-filters" aria-label="Filtrar por tempo de exemplo">${filters.map(([value,label]) => `<button class="wait-filter ${value === selected ? 'active' : ''}" aria-pressed="${value === selected}" onclick="filtrarAtendimentos('${value}')">${value === 'todos' ? '' : `<span class="filter-dot status-dot-${value}"></span>`}${label}</button>`).join('')}</div>
                    <div id="cardsContainer" class="unit-grid">${filtered.length ? filtered.map((u,i) => {
                        const count = portalMedicos(u).length
                        const status = statusDaUnidade(u)
                        const slot = 11 + ordenarUnidades(unidades).findIndex(item => item._id === u._id)
                        return `<article id="card-upa-${escapeHTML(u._id)}" class="unit-card">
                            <div class="unit-card-media">${portalPhoto(u,i === 0)}<span class="unit-card-status status-${status}"><i class="status-dot-${status}"></i>${escapeHTML(textoStatusTempo(status))}</span></div>
                            <div class="unit-card-content"><p class="unit-card-kicker">UNIDADE DE ATENDIMENTO</p><h2 class="unit-card-title">${escapeHTML(nomeCurtoUPA(u))}</h2>
                            <div class="unit-card-metrics"><div class="unit-card-metric">${portalIcon('clock')}<span><small>Espera de exemplo</small><strong>${escapeHTML(portalTempo(u))}</strong></span></div><div class="unit-card-metric">${portalIcon('team')}<span><small>Equipe cadastrada</small><strong>${count ? `${count} ${count === 1 ? 'médico' : 'médicos'}` : 'Não informada'}</strong></span></div></div>
                            <p class="unit-card-updated">Cadastro de exemplo · ${escapeHTML(portalAtualizacao(u))}</p>
                            <button class="unit-card-action" aria-label="Ver detalhes de ${escapeHTML(nomeCurtoUPA(u))}" onclick="verDetalhesPorId('${escapeHTML(u._id)}')">Ver detalhes ${portalIcon('arrow')}</button>
                            ${portalAdSlot(`adCard${slot}`,slot,'ads-slot-card')}</div></article>`
                    }).join('') : '<div class="empty-state"><h3>Nenhuma unidade nesta faixa</h3><p>Escolha outro filtro para continuar.</p><button class="button-secondary" onclick="filtrarAtendimentos(\'todos\')">Mostrar todas</button></div>'}</div>
                    ${portalAdSlot('adBannerInferior',17,'ads-slot-banner')}
                </section>
                <aside class="ads-side ads-lateral-coluna" aria-label="Publicidade lateral direita">${[5,6,7,8].map((n,i) => portalAdSlot(`adLateralDireita${i+1}`, n, 'ads-slot-lateral-pequeno')).join('')}</aside>
            </div>
        </div>`
    iniciarCarrosseisAds()
}

function htmlMedicosDetalhe(u) {
    const staff = medicosDaUnidade(u)
    if (!staff.length) return '<p class="data-note">Equipe ainda não informada.</p>'
    return staff.map(m => `<div class="staff-item"><span class="staff-avatar" aria-hidden="true">${portalIcon('team')}</span><div><strong>${escapeHTML(m.nome || 'Nome não informado')}</strong><span>${escapeHTML(m.especialidade || 'Especialidade não informada')}</span><small>Horário do plantão não informado</small></div></div>`).join('')
}

function verDetalhes(u) {
    limparTimersAds()
    fecharMenuUsuario()
    for (const id of ['map','formulario','login','perfil','adminPanel']) document.getElementById(id).style.display = 'none'
    document.getElementById('lista').style.display = 'block'
    document.getElementById('lista').innerHTML = `<div class="page-shell unit-detail">
        <div class="detail-topline"><button class="detail-back" onclick="mostrarLista()">${portalIcon('back')} Todas as unidades</button><span class="detail-example-label">DADOS DE DEMONSTRAÇÃO</span></div>
        <article class="detail-grid"><div class="detail-media">${portalPhoto(u,false,true)}</div><div class="detail-body">
            <p class="hero-eyebrow">GUARUJÁ · UNIDADE DE ATENDIMENTO</p><h1 class="detail-title">${escapeHTML(nomeCurtoUPA(u))}</h1><p class="detail-address">${portalIcon('pin')}${escapeHTML(enderecoDaUnidade(u))}</p>
            <div class="detail-info-grid"><section class="detail-info"><span>Espera de exemplo</span><strong>${escapeHTML(portalTempo(u))}</strong><small>Não é uma previsão de atendimento.</small></section><section class="detail-info"><span>Pessoas aguardando</span><strong class="info-unavailable">Não informado</strong><small>A integração com a unidade ainda não está ativa.</small></section></div>
            <div class="detail-contact">${htmlTelefoneDetalhe(u)}</div>
            <div class="detail-actions"><button class="button-primary" onclick="abrirRota(${Number(u.lat)||0},${Number(u.lng)||0})">${portalIcon('map')} Abrir rota</button><button class="button-secondary" onclick="mostrarMapa()">Ver todas no mapa</button></div>
        </div></article>
        <section class="detail-staff" aria-labelledby="plantaoTitulo"><div class="section-heading"><div><p class="section-kicker">CONHEÇA A EQUIPE</p><h2 id="plantaoTitulo" class="section-title">Plantão cadastrado</h2><p class="section-copy">Nomes e especialidades de exemplo. Presença não confirmada.</p></div></div><div class="staff-list">${htmlMedicosDetalhe(u)}</div></section>
        <p class="data-note">Registro de demonstração: ${escapeHTML(portalAtualizacao(u))}. Confirme as informações diretamente com a unidade.</p>
        ${portalAdSlot('adDetalheUpa',16,'ads-slot-banner')}
    </div>`
    const config = anunciosDaArea('ADS_16')
    renderizarCarrosselAds('adDetalheUpa',config.anuncios,'PUBLICIDADE',0,{...config,numero:16})
    portalScrollTop()
}

async function carregarDados() {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(),15000)
    try {
        const [response, photos] = await Promise.all([fetch(`${API}/atendimento`,{cache:'no-store',signal:controller.signal}),fetch('/images/units.json',{cache:'no-store',signal:controller.signal}).then(r => r.ok ? r.json() : []).catch(() => [])])
        if (!response.ok) throw new Error(`Atendimento HTTP ${response.status}`)
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('Resposta de atendimento inválida')
        unidades = data
        portalPhotoAssets = Array.isArray(photos) ? photos : []
        carregarLista()
        preencherSelectUPA()
        if (map) atualizarMapa()
        Promise.allSettled([carregarAnunciosPublicos(),carregarAreasAdsPublicas()]).then(() => {
            portalIniciarRodape()
            if (document.getElementById('cardsContainer')) iniciarCarrosseisAds()
            else if (document.getElementById('adDetalheUpa')) { const c=anunciosDaArea('ADS_16');renderizarCarrosselAds('adDetalheUpa',c.anuncios,'PUBLICIDADE',0,{...c,numero:16}) }
        })
    } catch (error) {
        console.error('Não foi possível carregar as unidades:',error.name)
        document.getElementById('lista').innerHTML = '<div class="page-shell empty-state" role="status"><h1>Não conseguimos carregar as unidades</h1><p>Verifique sua conexão e tente novamente. As informações de atendimento precisam de internet.</p><button class="button-primary" onclick="carregarDados()">Tentar novamente</button></div>'
    } finally {clearTimeout(timeout)}
}

function limparTimersAds() {
    if (portalAdObserver) portalAdObserver.disconnect()
    portalAdStates.forEach((s,el) => {
        clearTimeout(s.timer)
        el.querySelectorAll('video').forEach(v=>v.pause())
        if (el.isConnected && ['adRodape1','adRodape2'].includes(el.id)) {
            s.visible=false
            if(portalAdObserver)portalAdObserver.observe(el)
            else {s.visible=true;atualizarAnuncioVisivel(s)}
        } else portalAdStates.delete(el)
    })
}

function portalIniciarRodape() {
    for(const [id,code,number] of [['adRodape1','ADS_09',9],['adRodape2','ADS_10',10]]){
        const config=anunciosDaArea(code)
        renderizarCarrosselAds(id,config.anuncios,`<span class="ads-numero-slot">${number}</span>`,0,{...config,numero:number})
    }
}

function criarMidiaAnuncioPublico(a) {
    const src=escapeHTML(midiaAnuncio(a)),name=escapeHTML(a.nome||'Publicidade')
    return a.tipoMidia==='video' ? `<video class="ad-midia-publica" src="${src}" preload="none" muted loop playsinline controls aria-label="${name}"></video>` : `<img class="ad-midia-publica" src="${src}" alt="${name}" loading="lazy" decoding="async">`
}

function atualizarAnuncioVisivel(s) {
    clearTimeout(s.timer)
    if (!s.element.isConnected || !s.visible || document.hidden || !s.element.getClientRects().length) {s.element.querySelectorAll('video').forEach(v=>v.pause());return}
    if (!s.mounted) {
        const a=s.anuncios[s.index%s.anuncios.length],link=linkSeguroAnuncio(a.linkDestino)
        const content=`<span class="ad-etiqueta-publicidade">Publicidade</span>${criarMidiaAnuncioPublico(a)}`
        s.element.innerHTML=link?`<a class="ad-link-publico" href="${escapeHTML(link)}" target="_blank" rel="noopener sponsored" title="${escapeHTML(a.nome||'Publicidade')}">${content}</a>`:`<div class="ad-link-publico">${content}</div>`
        s.mounted=true
    }
    const video=s.element.querySelector('video')
    if(video&&!portalSaveData&&!portalReducedMotion.matches)video.play().catch(()=>{})
    if(s.anuncios.length>1&&s.options.rotacionar!==false&&!portalSaveData&&!portalReducedMotion.matches){
        const a=s.anuncios[s.index%s.anuncios.length]
        s.timer=setTimeout(()=>{s.index++;s.mounted=false;atualizarAnuncioVisivel(s)},Math.max(5,Number(a.tempoExibicaoSegundos||s.options.tempoTrocaSegundos)||6)*1000)
    }
}

function renderizarCarrosselAds(elementId,anuncios,textoVazio='PUBLICIDADE',indiceInicial=0,opcoes={}) {
    const el=document.getElementById(elementId)
    if(!el)return
    const old=portalAdStates.get(el)
    if(old){clearTimeout(old.timer);portalAdStates.delete(el);portalAdObserver?.unobserve(el)}
    if(!Array.isArray(anuncios)||!anuncios.length){el.classList.add('vazio');el.classList.remove('tem-ads');el.innerHTML=`<div class="ads-placeholder">${textoVazio}</div>`;return}
    el.classList.remove('vazio');el.classList.add('tem-ads')
    const state={element:el,anuncios,index:indiceInicial,options:opcoes,visible:!portalAdObserver,mounted:false,timer:null}
    portalAdStates.set(el,state)
    if(portalAdObserver)portalAdObserver.observe(el);else atualizarAnuncioVisivel(state)
}

document.addEventListener('visibilitychange',()=>portalAdStates.forEach(atualizarAnuncioVisivel))
portalReducedMotion.addEventListener('change',()=>portalAdStates.forEach(atualizarAnuncioVisivel))

async function carregarMapa() {
    if(!window.L){
        if(!portalMapLoading)portalMapLoading=new Promise((resolve,reject)=>{
            const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/leaflet/leaflet.css';document.head.appendChild(css)
            const script=document.createElement('script');script.src='/vendor/leaflet/leaflet.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)
        }).catch(error=>{portalMapLoading=null;throw error})
        await portalMapLoading
    }
    if(!map){
        map=L.map('map').setView([-23.97,-46.25],12)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map)
        markersLayer=L.layerGroup().addTo(map)
        const notice=L.control({position:'topright'})
        notice.onAdd=()=>{const el=L.DomUtil.create('div','map-demo-note');el.textContent='Demonstração · tempos e equipes de exemplo';return el}
        notice.addTo(map)
    }
    atualizarMapa()
    requestAnimationFrame(()=>map.invalidateSize())
}

async function mostrarMapa() {
    limparTimersAds();fecharMenuUsuario()
    for(const id of ['lista','formulario','login','perfil','adminPanel'])document.getElementById(id).style.display='none'
    document.getElementById('map').style.display='block'
    try{await carregarMapa()}catch{document.getElementById('map').innerHTML='<div class="empty-state"><h2>Mapa indisponível</h2><p>Você pode consultar endereços e rotas nos detalhes das unidades.</p><button class="button-primary" onclick="mostrarLista()">Ver unidades</button></div>'}
}

carregarDados()
atualizarInterfaceUsuario()
