const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const Anuncio = require('../models/Anuncio')
const User = require('../models/User')
const router = require('./anuncios')

test('publicidade respeita período e parceiro ativo; painel não aceita visitante ou funcionário', async t => {
    process.env.JWT_SECRET = 'chave-efemera-testes-publicidade'
    const before = new Date(Date.now()-86400000), after = new Date(Date.now()+86400000)
    const rows = [
        {_id:'imagem',tipoMidia:'imagem',patrocinador:{status:'ativo'},dataInicio:before,dataFim:after},
        {_id:'video',tipoMidia:'video',patrocinador:{status:'ativo'}},
        {_id:'futuro',patrocinador:{status:'ativo'},dataInicio:after},
        {_id:'vencido',patrocinador:{status:'ativo'},dataFim:before},
        {_id:'inativo',patrocinador:{status:'inativo'}},
        {_id:'sem-parceiro',patrocinador:null}
    ]
    let queries = 0
    t.mock.method(Anuncio,'find',query => {
        queries++
        if (queries === 1) assert.equal(query.status,'ativo')
        else assert.deepEqual(query.status,{ $ne:'removido' })
        return {populate:()=>({sort:async()=>rows})}
    })
    const app=express();app.use(express.json(), router)
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve))
    t.after(()=>new Promise(resolve=>server.close(resolve)))
    const base='http://127.0.0.1:'+server.address().port
    assert.deepEqual((await(await fetch(base+'/publicos')).json()).map(row=>row._id),['imagem','video'])
    const count=queries
    let role = 'funcionario'
    t.mock.method(User, 'findById', () => ({ select: async () => ({ tipo: role, status: 'ativo' }) }))
    assert.equal((await fetch(base)).status,401)
    const staff=jwt.sign({id:'692000000000000000000001',tipo:'funcionario'},process.env.JWT_SECRET)
    assert.equal((await fetch(base,{headers:{Authorization:staff}})).status,403)
    assert.equal(queries,count,'Forbidden users must not reach the ad query')
    const admin=jwt.sign({id:'692000000000000000000001',tipo:'admin'},process.env.JWT_SECRET)
    role = 'admin'
    assert.equal((await fetch(base,{headers:{Authorization:admin}})).status,200)
    for (const linkDestino of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com']) {
        const response = await fetch(base, { method: 'POST', headers: { Authorization: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ patrocinador: 'example', nome: 'Teste', posicao: 'card', linkDestino }) })
        assert.equal(response.status, 400, 'Unsafe ad links must be rejected before creating an ad')
    }
})
