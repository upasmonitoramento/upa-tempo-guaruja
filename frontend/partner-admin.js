(() => {
    'use strict'
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    const date = (value, end = false) => value ? new Date(+new Date(value) - (end ? 1 : 0)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'A definir'
    const price = p => p.fundingType === 'courtesy' ? 'Cortesia · sem cobrança' : money(p.cents)
    const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
    async function request(path, { method = 'GET', body } = {}) {
        const response = await fetch(API + '/admin/parceiros' + path, { method, headers: { Authorization: localStorage.getItem('token') || '', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(28000) })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar a revisão. Entre novamente se necessário.')
        return data
    }
    window.enviarConviteParceiro = id => request('/campanhas/' + id + '/convite', { method: 'POST', body: {} })
    window.renderPartnerReviews = async (section, options = {}) => {
        const viewId = Symbol('partner-review')
        section.partnerReviewView = viewId
        const current = () => section.isConnected && section.partnerReviewView === viewId
        const report = options.message || (() => {})
        let selected = 'all', before = null, pages = [], busy = false
        const run = async (button, action) => {
            if (busy) return
            busy = true; if (button) button.disabled = true; report('Aguarde…')
            try { await action() } catch (error) { report(error.message) }
            finally { busy = false; if (button?.isConnected) button.disabled = false }
        }
        const labels = { all: 'Todas', draft: 'Aguardando artes', pending: 'Em revisão', changes: 'Ajustes solicitados', approved: 'Aprovadas', renewal: 'Renovações' }
        async function list() {
            const data = await request('/revisoes?state=' + selected + (before ? '&before=' + before : ''))
            if (!current()) return
            section.innerHTML = `<div class="commercial-section-title"><div><p class="commercial-eyebrow">PORTAL DO PARCEIRO</p><h2>Revisão de campanhas</h2><p>Campanhas pagas e cortesias, com artes e programação no mesmo lugar.</p></div><div class="commercial-actions"><button type="button" data-courtesy>Nova cortesia</button><button type="button" data-manual>Anúncios manuais</button><button type="button" data-companies>Empresas</button><button type="button" data-legacy>Gerenciar espaços</button></div></div><div class="commercial-filters" role="group" aria-label="Filtrar revisões">${Object.entries(labels).map(([key, label]) => `<button type="button" data-review-filter="${key}" aria-pressed="${selected === key}">${label}</button>`).join('')}</div><div class="commercial-companies">${data.items.map(p => `<article class="commercial-card"><div class="partner-review-heading"><div><h3>${esc(p.company)}</h3><p class="commercial-muted">${esc(p.packageName)} · ${price(p)}</p></div><span class="commercial-badge">${p.courtesyRevokedAt ? 'Cortesia encerrada' : p.fundingType === 'courtesy' ? 'Cortesia' : labels[p.reviewState] || labels[selected]}</span></div><p class="commercial-muted">${esc(p.cities.join(' · '))} · ${p.durationDays || '—'} dias · ${p.assets?.length || 0} arquivo(s)</p>${selected === 'renewal' ? `<p class="commercial-muted">${p.renewalArt === 'new' ? 'Solicitou novas artes' : 'Quer manter as artes'} · ${date(p.renewalRequestedAt)}</p>` : ''}<button type="button" data-review="${esc(p._id)}">Abrir ficha e artes</button></article>`).join('') || '<div class="commercial-empty"><h3>Nenhuma campanha nesta lista</h3><p>Novos envios aparecerão aqui depois que o parceiro confirmar seu acesso e enviar as artes.</p></div>'}</div><div class="commercial-actions"><button data-prev ${!pages.length ? 'disabled' : ''}>Anterior</button><button data-next ${!data.next ? 'disabled' : ''}>Próxima</button></div>`
            section.querySelector('[data-courtesy]').onclick = () => run(null, () => courtesyForm(section, { back: list, created: detail, legacy: options.legacy }))
            section.querySelector('[data-legacy]').onclick = () => options.legacy?.('areasAds')
            section.querySelector('[data-manual]').onclick = () => options.legacy?.('anuncios')
            section.querySelector('[data-companies]').onclick = () => options.legacy?.('patrocinadores')
            section.querySelectorAll('[data-review-filter]').forEach(b => b.onclick = () => run(b, async () => { selected = b.dataset.reviewFilter; before = null; pages = []; await list(); report('') }))
            section.querySelectorAll('[data-review]').forEach(b => b.onclick = () => run(b, async () => { await detail(b.dataset.review); report('') }))
            section.querySelector('[data-next]').onclick = event => run(event.currentTarget, async () => { pages.push(before); before = data.next; await list(); report('') })
            section.querySelector('[data-prev]').onclick = event => run(event.currentTarget, async () => { before = pages.pop(); await list(); report('') })
        }
        async function detail(id) {
            const p = await request('/campanhas/' + id)
            if (options.changed) await options.changed().catch(() => {})
            if (!current()) return
            section.innerHTML = `<button type="button" data-back>← Todas as revisões</button><article class="commercial-card partner-review-profile"><div class="commercial-section-title"><div><p class="commercial-eyebrow">FICHA DA CAMPANHA</p><h2>${esc(p.company)}</h2><p>${esc(p.email)}</p></div><span class="commercial-badge ${p.paymentStatus === 'RECEIVED' ? 'is-paid' : ''}">${p.fundingType === 'courtesy' ? p.courtesyRevokedAt ? 'Cortesia encerrada' : 'Cortesia autorizada' : p.paymentStatus === 'RECEIVED' ? 'Valor recebido no Asaas' : 'Pagamento não recebido'}</span></div><div class="partner-review-facts"><div><small>Pacote</small><strong>${esc(p.packageName)}</strong></div><div><small>Valor</small><strong>${price(p)}</strong></div><div><small>Duração</small><strong>${p.durationDays || '—'} dias</strong></div><div><small>Cidades</small><strong>${esc(p.cities.join(' · '))}</strong></div></div><p class="commercial-muted">Link do anúncio: ${p.destination ? `<a href="${esc(p.destination)}" target="_blank" rel="noopener noreferrer">${esc(p.destination)}</a>` : 'Sem link'}</p>${p.renewalRequestedAt ? `<p class="partner-review-notice">Renovação solicitada: ${p.renewalArt === 'new' ? 'novas artes' : 'manter artes'}. Prepare uma nova proposta na aba Parcerias. Esse pedido não gera cobrança automática.</p>` : ''}${p.reviewFeedback ? `<p class="partner-review-notice">${esc(p.reviewFeedback)}</p>` : ''}<div class="commercial-actions"><button type="button" data-invite>Enviar acesso por email</button>${p.fundingType === "courtesy" && !p.courtesyRevokedAt ? `<button type="button" data-revoke>Encerrar cortesia</button>` : ""}</div></article><div class="commercial-companies">${(p.requirements || []).map(r => { const asset = p.assets.find(a => a.key === r.key); return `<article class="commercial-card"><h3>${esc(r.label)}</h3><p class="commercial-muted">${r.width} × ${r.height} pixels</p>${asset ? `<div class="partner-review-asset">${asset.thumbnailUrl ? `<img src="${esc(asset.thumbnailUrl)}" alt="Prévia da arte" loading="lazy" decoding="async" width="150" height="90">` : '<span class="commercial-badge">Vídeo</span>'}<p class="commercial-muted">${Math.ceil(asset.bytes / 1024)} KB${asset.duration ? ' · ' + asset.duration + ' s' : ''}</p><button type="button" data-preview="${esc(r.key)}">Ver arte completa</button></div>` : '<p class="commercial-muted">Arquivo não enviado.</p>'}</article>` }).join('')}</div><div id="partnerApproval"></div>${p.reviewState === 'pending' && !p.portalPaused ? `<div class="commercial-card partner-review-decision"><h3>Decisão da revisão</h3><p class="commercial-muted">Confira todas as artes e o link. ${p.fundingType === 'courtesy' ? 'A autorização da cortesia será conferida antes da liberação.' : 'O recebimento será consultado novamente no Asaas antes da liberação.'}</p><button type="button" data-approve>Aprovar e conferir programação</button><details><summary>Solicitar ajustes ao parceiro</summary><form class="commercial-form"><label class="commercial-wide">O que precisa ser corrigido?<textarea name="feedback" required minlength="3" maxlength="500" rows="3"></textarea></label><button type="submit">Enviar solicitação de ajuste</button></form></details></div>` : `<p class="commercial-muted">${p.reviewState === 'approved' ? `Programação: ${date(p.campaignStart)} a ${date(p.campaignEnd, true)}.` : p.fundingType === 'courtesy' ? p.courtesyRevokedAt ? 'Cortesia encerrada pela administração.' : 'Envie as artes acima ou convide o parceiro por email.' : 'Aguardando o parceiro enviar a revisão.'}</p>`}`
            const editable = p.fundingType === 'courtesy' && !p.portalPaused && !p.courtesyRevokedAt && p.reviewState !== 'pending' && (!p.campaignEnd || new Date(p.campaignEnd) > new Date())
            const revoke = section.querySelector('[data-revoke]')
            if (revoke) revoke.onclick = () => { if (confirm('Encerrar esta cortesia? Ela deixará de ser exibida nas próximas consultas.')) run(revoke, async () => { const result = await request('/campanhas/' + id + '/encerrar-cortesia', { method: 'POST', body: { revision: p.revision, confirmed: true } }); await detail(id); report(result.msg) }) }
            if (editable) {
                const editor = document.createElement('div'); editor.className = 'commercial-card'
                editor.innerHTML = `<h3>Enviar artes pelo administrador</h3><p class="commercial-muted">Até 4 MB; dimensões exatas. Vídeo de até 15 segundos. A revisão usa a mesma confirmação em duas etapas.</p>${p.requirements.map(r => `<label class="courtesy-upload">${esc(r.label)} · ${r.width} × ${r.height}<input type="file" data-upload="${esc(r.key)}" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"></label>`).join('')}<form class="commercial-form"><label class="commercial-wide">Link do anúncio (opcional)<input name="destination" type="url" placeholder="https://" value="${esc(p.destination || '')}" maxlength="2048"></label><button type="submit" ${!p.requirements.every(r => p.assets.some(a => a.key === r.key)) ? 'disabled' : ''}>Enviar para revisão</button></form>`
                section.querySelector('#partnerApproval').before(editor)
                editor.querySelectorAll('[data-upload]').forEach(input => input.onchange = () => run(input, async () => {
                    const file = input.files[0]; if (!file) return
                    if (file.size > 4 * 1024 * 1024) throw new Error('Escolha um arquivo de até 4 MB.')
                    const destination = editor.querySelector('[name=destination]').value
                    const body = new FormData(); body.append('file', file)
                    await request('/campanhas/' + id + '/artes/' + input.dataset.upload + '?revision=' + p.revision, { method: 'POST', body })
                    await detail(id)
                    const field = section.querySelector('[name=destination]'); if (field) field.value = destination
                    report('Arte validada e salva. Envie todos os formatos para revisão.')
                }))
                editor.querySelector('form').onsubmit = event => { event.preventDefault(); run(event.submitter, async () => { const result = await request('/campanhas/' + id + '/revisao', { method: 'POST', body: { revision: p.revision, destination: event.target.elements.destination.value } }); await detail(id); report(result.msg) }) }
            }
            section.querySelector('[data-back]').onclick = () => run(null, async () => { await list(); report('') })
            section.querySelector('[data-invite]').onclick = event => run(event.currentTarget, async () => { const result = await window.enviarConviteParceiro(id); report(result.msg) })
            section.querySelectorAll('[data-preview]').forEach(b => b.onclick = () => {
                const a = p.assets.find(item => item.key === b.dataset.preview)
                const preview = document.createElement('dialog'); preview.className = 'partner-review-preview'; preview.setAttribute('aria-label', 'Prévia completa da arte')
                preview.innerHTML = `<button type="button">Fechar prévia</button>${a.type === 'video' ? `<video controls playsinline preload="metadata" src="${esc(a.url)}"></video>` : `<img src="${esc(a.url)}" alt="Arte enviada pelo parceiro">`}`
                document.body.append(preview); preview.querySelector('button').onclick = () => preview.close(); preview.onclose = () => { preview.querySelector('video')?.pause(); preview.remove() }; preview.showModal()
            })
            const approve = section.querySelector('[data-approve]')
            if (approve) approve.onclick = () => run(approve, async () => {
                const result = await request('/campanhas/' + id + '/preparar-aprovacao', { method: 'POST', body: { revision: p.revision } })
                if (!current()) return
                const area = section.querySelector('#partnerApproval')
                area.innerHTML = `<section class="commercial-card partner-review-confirm" aria-labelledby="partnerApprovalTitle"><h3 id="partnerApprovalTitle">Confirmar aprovação</h3><p><strong>${esc(result.company)}</strong> · ${esc(result.packageName)} · ${price(result)}</p><p class="commercial-muted">${date(result.start)} a ${date(result.end, true)} · ${esc(result.cities.join(' · '))} · ${result.formats} formato(s).</p><label><input type="checkbox" data-checked> ${result.fundingType === 'courtesy' ? 'Conferi a cortesia autorizada e revisei todas as artes e o link de destino.' : 'Conferi o recebimento no Asaas e revisei todas as artes e o link de destino.'}</label><div class="commercial-actions"><button type="button" data-confirm disabled>Confirmar aprovação e programação</button><button type="button" data-cancel>Voltar à revisão</button></div></section>`
                area.querySelector('[data-checked]').onchange = event => { area.querySelector('[data-confirm]').disabled = !event.target.checked }
                area.querySelector('[data-cancel]').onclick = () => { area.innerHTML = '' }
                area.querySelector('[data-confirm]').onclick = event => run(event.currentTarget, async () => { const saved = await request('/campanhas/' + id + '/aprovar', { method: 'POST', body: { revision: p.revision, token: result.token, confirmed: true } }); await detail(id); report(saved.msg) })
                area.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); report('Elegibilidade conferida. Revise o resumo e confirme para publicar.')
            })
            const form = section.querySelector('.partner-review-decision form')
            if (form) form.onsubmit = event => { event.preventDefault(); run(event.submitter, async () => { const result = await request('/campanhas/' + id + '/ajustes', { method: 'POST', body: { revision: p.revision, feedback: form.elements.feedback.value } }); await detail(id); report(result.msg) }) }
        }
        if (options.campaignId) await detail(options.campaignId)
        else await list()
    }
    async function courtesyForm(section, options) {
        section.innerHTML = `<button type="button" data-back>← Campanhas</button><article class="commercial-card"><h2>Nova cortesia</h2><p class="commercial-muted">Sem cobrança e sem registro de pagamento. Use uma empresa já cadastrada ou cadastre pela ferramenta Empresas.</p><label>Buscar empresa<div class="commercial-actions"><input type="search" data-search placeholder="Nome da empresa" maxlength="80"><button type="button" data-search-button>Buscar empresas</button></div></label><p role="status" data-status></p><form class="commercial-form"><label class="commercial-wide">Empresa<select name="sponsor" required><option value="">Carregando empresas…</option></select></label><label>Email do parceiro<input name="email" type="email" required maxlength="160" autocomplete="email"></label><label>Duração<select name="durationDays"><option value="14">2 semanas · 14 dias</option><option value="28">4 semanas · 28 dias</option></select></label><p class="commercial-muted">Guarujá · início no próximo dia útil após aprovar as artes.</p><label class="commercial-wide">Motivo da cortesia<textarea name="reason" required minlength="3" maxlength="500" rows="2" placeholder="Ex.: divulgação própria autorizada"></textarea></label><fieldset class="commercial-wide"><legend>Onde os anúncios aparecerão</legend>${[['card','Cards das unidades'],['detalhe','Detalhes da unidade'],['rodape','Rodapé'],['banner','Banner']].map(([key,label])=>`<label><input name="positions" type="checkbox" value="${key}">${label}</label>`).join('')}</fieldset><label class="commercial-check commercial-wide"><input name="confirmed" type="checkbox" required> Autorizo esta cortesia, sem gerar pagamento.</label><button type="submit">Criar cortesia</button></form></article>`
        section.querySelector('[data-back]').onclick = options.back
        const status = section.querySelector('[data-status]'), form = section.querySelector('form')
        async function search() {
            const data = await request('/empresas?busca=' + encodeURIComponent(section.querySelector('[data-search]').value))
            form.elements.sponsor.innerHTML = '<option value="">Selecione a empresa</option>' + data.items.map(p=>`<option value="${esc(p._id)}">${esc(p.empresaNome)}</option>`).join('')
            status.textContent = data.items.length ? 'Até 25 empresas. Refine a busca se necessário.' : 'Nenhuma empresa ativa. Cadastre em Campanhas → Empresas.'
        }
        section.querySelector('[data-search-button]').onclick = () => search().catch(error=>{status.textContent=error.message})
        form.onsubmit = async event => {
            event.preventDefault(); const button = event.submitter; button.disabled = true; status.textContent = 'Criando cortesia…'
            try {
                const fields = new FormData(form)
                const result = await request('/cortesias', { method: 'POST', body: { ...Object.fromEntries(fields), positions: fields.getAll('positions'), confirmed: fields.has('confirmed') } })
                await options.created(result.id)
            } catch (error) { status.textContent = error.message }
            finally { if (button.isConnected) button.disabled = false }
        }
        await search()
    }
})()
