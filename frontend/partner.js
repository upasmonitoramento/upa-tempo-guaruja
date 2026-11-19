(() => {
    'use strict'
    const API = globalThis.SAUDE_CONFIG?.apiOrigin || location.origin
    const content = document.getElementById('partnerContent'), status = document.getElementById('partnerStatus')
    const nav = document.querySelector('.partner-nav'), dialog = document.getElementById('partnerDialog')
    const key = 'conecta.partner.session'
    const hash = location.hash.slice(1).match(/^(invite|reset|unlock)=([a-f\d]{64})$/)
    let linkToken = hash?.[2]
    if (hash) history.replaceState(null, '', location.pathname)
    let stored
    try { stored = JSON.parse(sessionStorage.getItem(key) || 'null') } catch { sessionStorage.removeItem(key) }
    const state = { token: stored?.token, account: stored?.account, tab: 'campanhas', items: [], next: null, before: null, pages: [], filter: 'all', selected: null, config: {}, busy: false, link: null }
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
    const date = (value, end = false) => value ? new Date(+new Date(value) - (end ? 1 : 0)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Após aprovação'
    const native = () => Boolean(globalThis.Capacitor?.isNativePlatform?.() || globalThis.SAUDE_CONFIG)
    const icons = { campanhas: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4m10-4v4M3 10h18m-13 4h3m-3 3h6"/>', artes: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/>', conta: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>' }
    const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
    function message(text = '', error = false) { status.textContent = text; status.classList.toggle('is-error', error) }
    function saveSession(value) { state.token = value.token; state.account = value.account; sessionStorage.setItem(key, JSON.stringify(value)) }
    function clearSession() { state.token = null; state.account = null; state.items = []; state.tab = 'campanhas'; state.filter = 'all'; state.before = null; state.pages = []; state.selected = null; sessionStorage.removeItem(key); nav.hidden = true }
    async function request(path, { method = 'GET', body, file, authenticated = true } = {}) {
        const headers = {}
        if (authenticated && state.token) headers.Authorization = state.token
        if (body) headers['Content-Type'] = 'application/json'
        const res = await fetch(API + '/parceiros' + path, { method, headers, body: file || (body ? JSON.stringify(body) : undefined), signal: AbortSignal.timeout(file ? 45000 : 25000), credentials: 'omit' })
        const data = res.status === 204 ? {} : await res.json().catch(() => ({}))
        if (res.status === 401 && authenticated && state.token) { clearSession(); renderAuth() }
        if (!res.ok) throw new Error(data.erro || 'Não foi possível concluir. Atualize e tente novamente.')
        return data
    }
    async function action(button, operation) {
        if (state.busy) return
        state.busy = true
        if (button) button.disabled = true
        message('Aguarde…')
        try { await operation() }
        catch (error) { message(error instanceof TypeError || error.name === 'TimeoutError' ? 'Não foi possível conectar. Confira sua internet e tente novamente.' : error.message, true) }
        finally { state.busy = false; if (button?.isConnected) button.disabled = false }
    }
    function title(heading, text) {
        return `<header class="partner-title"><div><h1>${heading}</h1><p>${text}</p></div><button type="button" data-refresh aria-label="Atualizar informações">Atualizar</button></header>`
    }
    function setupNav() {
        nav.hidden = false
        nav.innerHTML = [['campanhas', 'Campanhas'], ['artes', 'Artes'], ['conta', 'Conta']].map(([name, label]) => `<button type="button" data-tab="${name}" ${state.tab === name ? 'aria-current="page"' : ''}>${icon(name)}<span>${label}</span></button>`).join('')
        nav.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { if (state.busy) return; state.tab = button.dataset.tab; message(); render(); window.scrollTo({ top: 0, behavior: 'instant' }) })
    }
    async function loadCampaigns() {
        const query = new URLSearchParams({ state: state.filter })
        if (state.before) query.set('before', state.before)
        const data = await request('/campanhas?' + query)
        state.items = data.items; state.next = data.next
        if (!state.items.some(p => p.id === state.selected)) state.selected = state.items[0]?.id
    }
    async function start() {
        state.account = await request('/conta')
        await loadCampaigns()
        render()
    }
    function badge(p) {
        if (p.portalPaused) return ['Pausada pela equipe', 'warning']
        if (p.fundingType !== 'courtesy' && p.paymentStatus !== 'RECEIVED') return ['Pagamento em verificação', 'warning']
        if (p.campaignEnd && new Date(p.campaignEnd) <= new Date()) return ['Encerrada', 'neutral']
        if (p.reviewState === 'pending') return ['Em revisão', 'neutral']
        if (p.reviewState === 'changes') return ['Ajustes solicitados', 'warning']
        if (p.reviewState === 'approved') return [new Date(p.campaignStart) > new Date() ? 'Programada' : 'No ar', 'paid']
        return [p.publishedAt ? 'Alterações em rascunho' : 'Aguardando artes', 'neutral']
    }
    const paymentLabel = value => ({ RECEIVED: 'Valor recebido', CONFIRMED: 'Confirmado, aguardando disponibilidade', PENDING: 'Aguardando pagamento', OVERDUE: 'Pagamento vencido', REFUNDED: 'Estornado', REFUND_REQUESTED: 'Estorno em análise', DELETED: 'Cobrança cancelada' })[value] || 'Em verificação'
    function safeInvoice(value) {
        try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && ['asaas.com', 'www.asaas.com', 'sandbox.asaas.com'].includes(u.hostname) ? u.href : '' } catch { return '' }
    }
    function bindRefresh() {
        const button = content.querySelector('[data-refresh]')
        if (button) button.onclick = () => action(button, async () => {
            const destination = content.querySelector('[name=destination]')?.value
            await loadCampaigns(); render()
            if (destination !== undefined && content.querySelector('[name=destination]')) content.querySelector('[name=destination]').value = destination
            message('Informações atualizadas.')
        })
    }
    function render() {
        setupNav()
        if (state.tab === 'campanhas') renderCampaigns()
        else if (state.tab === 'artes') renderAssets()
        else renderAccount()
        bindRefresh()
    }
    function renderCampaigns() {
        content.innerHTML = title('Suas campanhas', 'Acompanhe suas parcerias, pagamentos e próximos passos.') +
            `<div class="partner-filters" role="group" aria-label="Filtrar campanhas">${[['all','Todas'],['pending','Em revisão'],['active','Publicadas'],['ended','Encerradas']].map(([value, label]) => `<button type="button" data-filter="${value}" aria-pressed="${state.filter === value}">${label}</button>`).join('')}</div>` +
            (state.items.length ? `<div class="partner-grid">${state.items.map(p => {
                const [label, tone] = badge(p), invoice = safeInvoice(p.paymentUrl)
                const endsSoon = p.campaignEnd && +new Date(p.campaignEnd) - Date.now() <= 2 * 86400000 && new Date(p.campaignEnd) > new Date()
                return `<article class="partner-card" data-campaign="${esc(p.id)}"><div class="partner-card-top"><div><h2>${esc(p.company)}</h2><p>${esc(p.packageName)}</p></div><span class="partner-badge ${tone}">${label}</span></div>
                    <div class="partner-meta"><span>${esc(p.cities.join(' · '))}</span><span>${p.durationDays || '—'} dias</span><span>${p.fundingType === 'courtesy' ? 'Cortesia · sem cobrança' : money(p.cents)}</span></div>
                    ${endsSoon ? `<p class="partner-note warning">Seu período está terminando. Solicite a renovação para continuar anunciando.</p>` : ''}
                    ${p.renewalRequestedAt ? '<p class="partner-note">Pedido de renovação recebido pela equipe.</p>' : ''}
                    <button type="button" class="primary" data-art="${esc(p.id)}">${p.reviewState === 'draft' || p.reviewState === 'changes' ? 'Enviar ou ajustar artes' : 'Ver artes e revisão'}</button>
                    <details><summary>${p.fundingType === 'courtesy' ? 'Período da cortesia' : 'Período e pagamento'}</summary><dl class="partner-dl"><div><dt>Início</dt><dd>${date(p.campaignStart)}</dd></div><div><dt>Último dia</dt><dd>${date(p.campaignEnd, true)}</dd></div><div><dt>Pagamento</dt><dd>${p.fundingType === 'courtesy' ? 'Cortesia autorizada' : paymentLabel(p.paymentStatus)}</dd></div><div><dt>Pacote</dt><dd>${esc(p.packageName)}</dd></div></dl>
                    <p class="muted">O primeiro período começa no próximo dia útil após ${p.fundingType === 'courtesy' ? 'a autorização da cortesia e a aprovação das artes' : 'o recebimento do pagamento e a aprovação das artes'}. Alterar a arte não renova o período.</p>
                    <div class="partner-actions">${invoice && !native() ? `<a class="partner-button" href="${esc(invoice)}" target="_blank" rel="noopener noreferrer">Ver cobrança</a>` : ''}${p.fundingType === 'courtesy' ? '' : `<button type="button" data-payment="${esc(p.id)}">Conferir pagamento</button>`}${p.campaignEnd && !p.renewalRequestedAt ? `<button type="button" data-renew="${esc(p.id)}">Solicitar renovação</button>` : ''}</div></details></article>`
            }).join('')}</div>` : '<div class="partner-empty"><h2>Nenhuma campanha nesta lista</h2><p>As campanhas aparecem após pagamento recebido ou cortesia autorizada, com validação do convite enviado ao seu email.</p></div>') +
            `${state.pages.length || state.next ? `<div class="partner-pagination"><button type="button" data-previous ${!state.pages.length ? 'disabled' : ''}>Anterior</button><button type="button" data-next ${!state.next ? 'disabled' : ''}>Próxima</button></div>` : ''}`
        content.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => action(b, async () => { state.filter = b.dataset.filter; state.before = null; state.pages = []; await loadCampaigns(); render(); message() }))
        content.querySelectorAll('[data-art]').forEach(b => b.onclick = () => { state.selected = b.dataset.art; state.tab = 'artes'; message(); render(); window.scrollTo({ top: 0 }) })
        content.querySelectorAll('[data-payment]').forEach(b => b.onclick = () => action(b, async () => { await request('/campanhas/' + b.dataset.payment + '/pagamento', { method: 'POST', body: {} }); await loadCampaigns(); render(); message('Pagamento consultado no Asaas.') }))
        content.querySelectorAll('[data-renew]').forEach(b => b.onclick = () => renewalDialog(b.dataset.renew))
        const nextButton = content.querySelector('[data-next]')
        if (nextButton) nextButton.onclick = event => action(event.currentTarget, async () => { state.pages.push(state.before); state.before = state.next; await loadCampaigns(); render(); message() })
        const previousButton = content.querySelector('[data-previous]')
        if (previousButton) previousButton.onclick = event => action(event.currentTarget, async () => { state.before = state.pages.pop() || null; await loadCampaigns(); render(); message() })
    }
    function renewalDialog(id) {
        dialog.innerHTML = `<div class="partner-dialog-top"><h2 id="partnerDialogTitle">Renovar parceria</h2><button type="button" data-close>Fechar</button></div><p class="muted">A equipe preparará uma nova proposta. Nenhuma cobrança será criada por esta solicitação.</p><form class="partner-form"><label>Artes para o próximo período<select name="art" class="partner-select"><option value="keep">Quero manter as artes atuais</option><option value="new">Quero enviar novas artes</option></select></label><button type="submit" class="primary">Solicitar renovação</button></form>`
        dialog.querySelector('[data-close]').onclick = () => dialog.close()
        dialog.querySelector('form').onsubmit = event => { event.preventDefault(); action(event.submitter, async () => { const data = await request('/campanhas/' + id + '/renovacao', { method: 'POST', body: { art: dialog.querySelector('[name=art]').value } }); dialog.close(); await loadCampaigns(); render(); message(data.msg) }) }
        dialog.showModal()
    }
    function renderAssets() {
        content.innerHTML = title('Artes e revisão', 'Envie somente os formatos incluídos na sua parceria.')
        const p = state.items.find(item => item.id === state.selected)
        if (!p) { content.insertAdjacentHTML('beforeend', '<div class="partner-empty"><h2>Selecione uma campanha</h2><p>Abra uma campanha na primeira aba para enviar suas artes.</p></div>'); return }
        const locked = p.reviewState === 'pending' || p.portalPaused || p.fundingType !== 'courtesy' && p.paymentStatus !== 'RECEIVED' || p.campaignEnd && new Date(p.campaignEnd) <= new Date()
        const requirements = p.requirements || [], assets = p.assets || []
        const missing = requirements.filter(r => !assets.some(a => a.key === r.key)).length
        const [label, tone] = badge(p)
        content.insertAdjacentHTML('beforeend', `<label class="partner-selector">Campanha<select id="partnerCampaignSelect" class="partner-select">${state.items.map(item => `<option value="${esc(item.id)}" ${item.id === p.id ? 'selected' : ''}>${esc(item.company)} · ${esc(item.packageName)}</option>`).join('')}</select></label>
            <div class="partner-card-top"><h2>${esc(p.company)}</h2><span class="partner-badge ${tone}">${label}</span></div>
            ${p.reviewFeedback ? `<div class="partner-note warning"><strong>Ajustes solicitados</strong><p>${esc(p.reviewFeedback)}</p></div>` : ''}
            ${p.reviewState === 'pending' ? '<p class="partner-note">Artes enviadas. Aguarde a revisão da equipe; o resultado aparecerá aqui.</p>' : ''}
            ${p.publishedAt && !locked && p.reviewState !== 'approved' ? '<p class="partner-note">Estas alterações são um rascunho. A versão já aprovada continua no ar durante a revisão, dentro do período contratado.</p>' : ''}
            <details class="partner-file-rules"><summary>Formatos aceitos e limites</summary><p>Imagens JPG, PNG ou WEBP. Vídeos MP4 H.264 ou WebM VP8/VP9, até 15 segundos. Até 4 MB por arquivo. Use as dimensões indicadas.</p></details>
            <div class="partner-grid">${requirements.map(r => {
                const asset = assets.find(a => a.key === r.key)
                return `<article class="partner-card"><h3>${esc(r.label)}</h3><p class="muted">${r.width} × ${r.height} pixels</p>
                    ${asset ? `<div class="partner-asset">${asset.thumbnailUrl ? `<img class="partner-thumb" src="${esc(asset.thumbnailUrl)}" width="90" height="64" alt="Prévia da arte" loading="lazy" decoding="async">` : `<div class="partner-thumb partner-video-placeholder">${asset.type === 'video' ? 'Vídeo' : 'Imagem'}</div>`}<div><span class="partner-badge paid">Arquivo recebido</span><p>${Math.ceil(asset.bytes / 1024)} KB${asset.duration ? ' · ' + asset.duration + ' s' : ''}</p><button type="button" data-preview="${esc(r.key)}">Ver arquivo</button></div></div>` : '<p class="muted">Arquivo ainda não enviado.</p>'}
                    ${!locked ? `<label class="partner-form"><span class="muted">${asset ? 'Substituir arquivo' : 'Escolher arquivo'}</span><input type="file" data-upload="${esc(r.key)}" aria-label="${asset ? 'Substituir' : 'Enviar'} arte — ${esc(r.label)} ${r.width} × ${r.height}" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"></label>` : ''}</article>`
            }).join('')}</div>
            ${locked ? `<section class="partner-card partner-destination"><h3>Link de destino</h3><p class="muted">${p.destination ? `<a href="${esc(p.destination)}" target="_blank" rel="noopener noreferrer">${esc(p.destination)}</a>` : 'Sem link de destino.'}</p></section>` : requirements.length ? `<form id="partnerSubmitAssets" class="partner-card partner-destination partner-form"><label>Link ao clicar no anúncio (opcional)<input name="destination" type="url" maxlength="2048" placeholder="https://seusite.com.br" value="${esc(p.destination)}" ${locked ? 'readonly' : ''}></label><p class="muted">Pode ser seu site, loja ou link oficial do WhatsApp. A equipe revisará o destino.</p><button type="submit" class="primary" ${locked || missing ? 'disabled' : ''}>Enviar para revisão</button><p class="muted">${missing ? `Falta enviar ${missing} formato(s).` : locked ? 'Envio bloqueado enquanto a campanha está em revisão, pausada ou encerrada.' : 'A publicação depende da revisão. Enviar os arquivos não publica o anúncio automaticamente.'}</p></form>` : '<p class="partner-note">A equipe está preparando os formatos desta campanha.</p>'}`)
        content.querySelector('#partnerCampaignSelect').onchange = event => { if (state.busy) return; state.selected = event.target.value; message(); render() }
        content.querySelectorAll('[data-preview]').forEach(b => b.onclick = () => preview(assets.find(a => a.key === b.dataset.preview)))
        content.querySelectorAll('[data-upload]').forEach(input => input.onchange = () => action(null, async () => {
            const file = input.files[0]
            if (!file) { message(); return }
            if (file.size > 4 * 1024 * 1024) throw new Error('Escolha um arquivo de até 4 MB.')
            if (!/\.(jpe?g|png|webp|mp4|webm)$/i.test(file.name)) throw new Error('Use JPG, PNG, WEBP, MP4 ou WEBM.')
            content.querySelectorAll('input[type=file], select, button[type=submit]').forEach(el => { el.disabled = true })
            message('Enviando e validando o arquivo…')
            const form = new FormData(); form.append('file', file)
            const destination = content.querySelector('[name=destination]')?.value
            try {
                await request('/campanhas/' + p.id + '/artes/' + encodeURIComponent(input.dataset.upload) + '?revision=' + p.revision, { method: 'POST', file: form })
                await loadCampaigns(); render()
                if (destination !== undefined) content.querySelector('[name=destination]').value = destination
                message('Arquivo recebido e validado.')
            } catch (error) { render(); if (destination !== undefined && content.querySelector('[name=destination]')) content.querySelector('[name=destination]').value = destination; throw error }
        }))
        const form = content.querySelector('#partnerSubmitAssets')
        if (form) form.onsubmit = event => { event.preventDefault(); action(event.submitter, async () => { const data = await request('/campanhas/' + p.id + '/revisao', { method: 'POST', body: { revision: p.revision, destination: form.elements.destination.value } }); await loadCampaigns(); render(); message(data.msg) }) }
    }
    function preview(asset) {
        if (!asset) return
        dialog.innerHTML = `<div class="partner-dialog-top"><h2 id="partnerDialogTitle">Arquivo da campanha</h2><button type="button" data-close>Fechar</button></div>${asset.type === 'video' ? `<video controls playsinline preload="metadata" src="${esc(asset.url)}"></video>` : `<img src="${esc(asset.url)}" alt="Arte enviada para a campanha">`}`
        dialog.querySelector('[data-close]').onclick = () => dialog.close()
        dialog.onclose = () => { dialog.querySelector('video')?.pause(); dialog.innerHTML = '' }
        dialog.showModal()
    }
    function renderAccount() {
        content.innerHTML = title('Sua conta', 'Acesso validado e dados essenciais da parceria.') + `<div class="partner-account-grid"><section class="partner-card"><h2>Dados de acesso</h2><form id="partnerProfileForm" class="partner-form"><label>Nome de contato<input name="name" required maxlength="160" autocomplete="name" value="${esc(state.account.name)}"></label><label>Email validado<input type="email" readonly value="${esc(state.account.email)}" autocomplete="email"></label><span class="partner-badge paid">Email validado</span><p class="muted">Para corrigir o email ou os dados fiscais de uma proposta, fale com a equipe. A alteração precisa ser conferida.</p><button type="submit">Salvar nome</button></form><div class="partner-actions"><a class="partner-button" href="mailto:upasmonitoramento@gmail.com">Falar com a equipe</a><button type="button" data-logout>Sair do portal</button></div></section><section class="partner-card"><h2>Segurança</h2><p class="muted">Após três tentativas de senha incorreta, o acesso é bloqueado e enviamos um link de desbloqueio ao seu email.</p><details class="partner-security"><summary>Alterar minha senha</summary><form id="partnerPasswordForm" class="partner-form"><label>Senha atual<input name="currentPassword" type="password" required autocomplete="current-password"></label><label>Nova senha<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label>Repita a nova senha<input name="repeat" type="password" required minlength="8" autocomplete="new-password"></label><button type="submit">Alterar senha</button></form></details></section></div>`
        content.querySelector('#partnerProfileForm').onsubmit = event => { event.preventDefault(); action(event.submitter, async () => { const account = await request('/conta', { method: 'PUT', body: { name: event.target.elements.name.value } }); saveSession({ token: state.token, account }); render(); message('Nome atualizado.') }) }
        content.querySelector('#partnerPasswordForm').onsubmit = event => { event.preventDefault(); action(event.submitter, async () => {
            const fields = new FormData(event.target)
            if (fields.get('password') !== fields.get('repeat')) throw new Error('As novas senhas precisam ser iguais.')
            await request('/conta/senha', { method: 'POST', body: { password: fields.get('password'), currentPassword: fields.get('currentPassword') } })
            clearSession(); renderAuth(); message('Senha alterada. Entre novamente.')
        }) }
        content.querySelector('[data-logout]').onclick = event => action(event.currentTarget, async () => { try { await request('/sair', { method: 'POST', body: {} }) } finally { clearSession(); renderAuth(); message('Você saiu do portal.') } })
    }
    function authFrame(heading, description, form) {
        nav.hidden = true
        content.innerHTML = `<div class="partner-auth"><section class="partner-auth-intro"><span class="partner-kicker">Parcerias Conecta Saúde</span><h1>Sua publicidade, bem acompanhada.</h1><p>Envie suas artes e acompanhe cada etapa da parceria em um só lugar.</p><ol><li>Receba o convite após o pagamento confirmado.</li><li>Valide seu email e envie os formatos do pacote.</li><li>Acompanhe a revisão e a publicação.</li></ol></section><section class="partner-auth-form"><h2>${heading}</h2><p class="muted">${description}</p>${form}</section></div>`
    }
    function renderAuth(forgot = false) {
        if (forgot) {
            authFrame('Recuperar acesso', 'Use o mesmo email informado na parceria.', '<form class="partner-form" id="partnerRecovery"><label>Email<input name="email" type="email" required autocomplete="email" autocapitalize="none"></label><button type="submit" class="primary">Receber link por email</button><button type="button" class="partner-text-button" data-login>Voltar para entrar</button></form>')
            content.querySelector('[data-login]').onclick = () => { message(); renderAuth() }
            content.querySelector('form').onsubmit = event => { event.preventDefault(); action(event.submitter, async () => { const data = await request('/acesso/solicitar', { method: 'POST', authenticated: false, body: { email: event.target.elements.email.value } }); message(data.msg) }) }
            return
        }
        authFrame('Entrar como parceiro', 'Seu acesso é separado das contas da equipe do portal.', `<form class="partner-form" id="partnerLogin"><label>Email<input name="email" type="email" required autocomplete="username" autocapitalize="none" spellcheck="false"></label><label>Senha<div class="partner-field-row"><input name="password" type="password" required autocomplete="current-password" aria-label="Senha"><button type="button" data-show aria-label="Mostrar senha">Ver</button></div></label><button type="submit" class="primary">Entrar</button><button type="button" class="partner-text-button" data-recover>Esqueci minha senha ou ainda não recebi acesso</button></form>${!state.config.emailReady ? '<p class="partner-note">O envio de convites por email está sendo conectado. O acesso será liberado por convite para uma parceria paga ou cortesia.</p>' : '<p class="muted partner-section">Primeiro acesso? Use o convite enviado ao seu email após pagamento recebido ou cortesia autorizada. Confira também o spam.</p>'}`)
        content.querySelector('[data-show]').onclick = event => { const input = content.querySelector('[name=password]'); input.type = input.type === 'password' ? 'text' : 'password'; event.currentTarget.textContent = input.type === 'password' ? 'Ver' : 'Ocultar' }
        content.querySelector('[data-recover]').onclick = () => { message(); renderAuth(true) }
        content.querySelector('form').onsubmit = event => { event.preventDefault(); action(event.submitter, async () => {
            const form = event.target
            const data = await request('/login', { method: 'POST', authenticated: false, body: { email: form.elements.email.value, password: form.elements.password.value } })
            form.elements.password.value = ''; saveSession(data)
            if (linkToken && state.link?.existing) await confirmInvite()
            await start(); message()
        }) }
    }
    async function confirmInvite(password, policyAccepted) {
        const data = await request('/link/confirmar', { method: 'POST', body: { token: linkToken, password, policyAccepted } })
        if (data.token) saveSession(data)
        return data
    }
    async function renderLink() {
        state.link = await request('/link/consultar', { method: 'POST', authenticated: false, body: { token: linkToken } })
        if (state.link.existing && state.link.kind === 'invite') {
            renderAuth(); message(`Convite para ${state.link.company}. Entre com a conta de parceiro que usa o email ${state.link.email} para vincular a campanha.`)
            return
        }
        const invite = state.link.kind === 'invite'
        authFrame(invite ? 'Ative seu acesso' : 'Crie uma nova senha', `${invite ? state.link.company + ' · ' + state.link.packageName + '. ' : ''}O link recebido valida o email ${state.link.email}.`, `<form class="partner-form" id="partnerActivation"><label>${invite ? 'Crie sua senha' : 'Nova senha'}<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label>Repita a senha<input name="repeat" type="password" required minlength="8" autocomplete="new-password"></label>${invite ? '<label class="partner-check"><input type="checkbox" name="policy" required><span>Entendi que meu email será validado e que meus dados de acesso, propostas e artes serão usados para administrar minhas parcerias com o Conecta Saúde.</span></label>' : ''}<button type="submit" class="primary">${invite ? 'Validar email e criar acesso' : 'Salvar nova senha e desbloquear'}</button></form>`)
        content.querySelector('form').onsubmit = event => { event.preventDefault(); action(event.submitter, async () => {
            const form = event.target
            if (form.elements.password.value !== form.elements.repeat.value) throw new Error('As senhas precisam ser iguais.')
            const data = await confirmInvite(form.elements.password.value, Boolean(form.elements.policy?.checked))
            if (data.token) { state.link = null; await start(); message('Email validado. Seu portal está pronto para receber as artes.') }
            else { state.link = null; clearSession(); renderAuth(); message(data.msg) }
        }) }
    }
    async function init() {
        try {
            state.config = await request('/config', { authenticated: false })
            if (linkToken) await renderLink()
            else if (state.token) await start()
            else renderAuth()
            message(status.textContent === 'Carregando seu portal…' ? '' : status.textContent)
        } catch (error) { clearSession(); renderAuth(); message(error.message, true) }
    }
    window.addEventListener('hashchange', () => {
        const value = location.hash.slice(1).match(/^(invite|reset|unlock)=([a-f\d]{64})$/)
        if (!value) return
        linkToken = value[2]
        state.link = null
        history.replaceState(null, '', location.pathname)
        message('Validando seu link…')
        renderLink().then(() => { if (status.textContent === 'Validando seu link…') message() }).catch(error => { renderAuth(); message(error.message, true) })
    })
    init()
})()
