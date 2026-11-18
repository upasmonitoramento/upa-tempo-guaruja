const mongoose = require('mongoose')
const schema = new mongoose.Schema({
    _id: String, kind: { type: String, enum: ['invite', 'reset', 'unlock'], required: true },
    email: String, environment: String,
    partnership: mongoose.Schema.Types.ObjectId, account: mongoose.Schema.Types.ObjectId,
    expires: { type: Date, expires: 0 }, createdAt: { type: Date, default: Date.now }
})
schema.index({ account: 1, kind: 1, createdAt: -1 })
schema.index({ partnership: 1, kind: 1 })
module.exports = mongoose.model('PartnerToken', schema)
