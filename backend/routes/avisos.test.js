const test=require('node:test')
const assert=require('node:assert/strict')
const express=require('express')
const mongoose=require('mongoose')
const jwt=require('jsonwebtoken')
const User=require('../models/User')
const router=require('./avisos')
const Notice=mongoose.model('PortalNotice')
test('avisos são opcionais, agendados e apenas administrador ativo pode publicar',async t=>{
    process.env.JWT_SECRET='test-notice-only-key'
    let row=null, role='funcionario', writes=0
    t.mock.method(User,'findById',()=>({select:async()=>({tipo:role,status:'ativo'})}))
    t.mock.method(Notice,'findById',async()=>row)
    t.mock.method(Notice,'findOneAndUpdate',async(filter,update,options)=>{
        assert.equal(filter._id,'principal');assert.equal(options.upsert,true)
        row={...update.$set};writes++;return row
    })
    t.mock.method(Notice,'findOne',query=>({select:async fields=>{
        assert.equal(query.enabled,true);assert.equal(fields,'titulo mensagem revision')
        if(!row?.enabled||row.inicio>query.inicio.$lte||(row.fim&&row.fim<=query.$or[1].fim.$gt))return null
        return {titulo:row.titulo,mensagem:row.mensagem,revision:row.revision}
    }}))
    const app=express();app.use(express.json(),router)
    const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r))
    t.after(()=>new Promise(r=>server.close(r)))
    const base='http://127.0.0.1:'+server.address().port
    const headers={Authorization:jwt.sign({id:'692000000000000000000001',tipo:'admin'},process.env.JWT_SECRET),'Content-Type':'application/json'}
    const save=body=>fetch(base,{method:'PUT',headers,body:JSON.stringify(body)})
    assert.equal(await(await fetch(base+'/publico?cidade=guaruja')).json(),null)
    assert.equal((await fetch(base+'/publico?cidade=desconhecida')).status,400)
    assert.equal((await fetch(base)).status,401)
    assert.equal((await save({})).status,403)
    assert.equal(writes,0)
    role='admin'
    const value={enabled:true,titulo:'Manutenção programada',mensagem:'Hoje às 23h. <script>não executar</script>',cidade:'guaruja'}
    assert.equal((await save({...value,fim:'invalid'})).status,400)
    assert.equal((await save({...value,inicio:'2027-01-01',fim:'2026-01-01'})).status,400)
    assert.equal((await save({...value,titulo:'x'.repeat(81)})).status,400)
    assert.equal((await save({...value,inicio:new Date(Date.now()+60000).toISOString()})).status,200)
    assert.equal(await(await fetch(base+'/publico?cidade=guaruja')).json(),null)
    assert.equal((await save({...value,inicio:new Date(Date.now()-1000).toISOString()})).status,200)
    const active=await(await fetch(base+'/publico?cidade=guaruja')).json()
    assert.equal(active.titulo,value.titulo);assert.equal(active.mensagem,value.mensagem)
    const revision=active.revision
    assert.equal((await save({...value,enabled:false})).status,200)
    assert.equal(await(await fetch(base+'/publico?cidade=guaruja')).json(),null)
    assert.notEqual(row.revision,revision)
    assert.equal((await save({...value,inicio:'2025-01-01',fim:'2025-02-01'})).status,200)
    assert.equal(await(await fetch(base+'/publico?cidade=guaruja')).json(),null)
})
