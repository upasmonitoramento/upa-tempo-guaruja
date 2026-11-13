const express = require('express')
const mongoose = require('mongoose')
const { randomUUID } = require('node:crypto')
const auth = require('../middlewares/auth')
const User = require('../models/User')
const Notice = mongoose.model('PortalNotice', new mongoose.Schema({
    _id: String, enabled: Boolean, titulo: String, mensagem: String,
    cidade: String, inicio: Date, fim: Date, revision: String
}, { timestamps:true }))
const router = express.Router()
router.use((req,res,next) => { res.set('Cache-Control','no-store'); next() })
router.get('/publico', async (req,res,next) => {
    try {
        if (req.query.cidade !== 'guaruja') return res.status(400).json({ erro:'Cidade indisponível.' })
        const now = new Date()
        const item = await Notice.findOne({ _id:'principal', enabled:true, cidade:{ $in:['todas','guaruja'] },
            inicio:{ $lte:now }, $or:[{fim:null},{fim:{$gt:now}}] }).select('titulo mensagem revision')
        res.json(item)
    } catch(error) { next(error) }
})
router.use(auth, async (req,res,next) => {
    try {
        const user = await User.findById(req.user.id).select('tipo status')
        if (user?.tipo !== 'admin' || user.status !== 'ativo') return res.status(403).json({ erro:'Acesso exclusivo de administrador ativo.' })
        next()
    } catch(error) { next(error) }
})
router.get('/', async (req,res,next) => {
    try { res.json(await Notice.findById('principal') || { enabled:false, titulo:'', mensagem:'', cidade:'todas' }) }
    catch(error) { next(error) }
})
router.put('/', async (req,res,next) => {
    try {
        const { enabled, titulo, mensagem, cidade } = req.body
        const inicio = req.body.inicio ? new Date(req.body.inicio) : new Date()
        const fim = req.body.fim ? new Date(req.body.fim) : null
        if (typeof enabled !== 'boolean' || typeof titulo !== 'string' || typeof mensagem !== 'string' ||
            titulo.length > 80 || mensagem.length > 500 || (enabled && (!titulo.trim() || !mensagem.trim())) ||
            !['todas','guaruja'].includes(cidade) || !Number.isFinite(+inicio) || (fim && (!Number.isFinite(+fim) || fim <= inicio))) {
            return res.status(400).json({ erro:'Confira o título, a mensagem, a cidade e o período do aviso.' })
        }
        const item = await Notice.findOneAndUpdate({ _id:'principal' }, { $set:{ enabled, titulo:titulo.trim(), mensagem:mensagem.trim(), cidade, inicio, fim, revision:randomUUID() } }, { upsert:true, new:true, runValidators:true })
        res.json(item)
    } catch(error) { next(error) }
})
router.use((error,req,res,next) => { console.error('Avisos:',error.name); res.status(503).json({ erro:'Não foi possível carregar ou salvar o aviso. Tente novamente.' }) })
module.exports = router
