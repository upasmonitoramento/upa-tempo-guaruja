const mongoose = require('mongoose')

module.exports = mongoose.model('PasswordReset', new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    tokenHash: { type: String, required: true, unique: true },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }
}))
