const mongoose = require('mongoose')
const Schema = new mongoose.Schema({
    email: { type: String, required: true }, name: String,
    password: { type: String, required: true, select: false },
    environment: { type: String, enum: ['production', 'sandbox'], required: true },
    verifiedAt: Date, active: { type: Boolean, default: true }, policyVersion: String, policyAcceptedAt: Date,
    failedLogins: { type: Number, default: 0, select: false }, lockedAt: Date,
    sessionVersion: { type: Number, default: 0, select: false }
}, { timestamps: true })
Schema.index({ email: 1, environment: 1 }, { unique: true })
module.exports = mongoose.model('PartnerAccount', Schema)
