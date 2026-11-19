const mongoose = require('mongoose')
const Asset = new mongoose.Schema({ key: String, url: String, storageKey: String, thumbnailUrl: String, thumbnailKey: String, type: String, width: Number, height: Number, duration: Number, bytes: Number }, { _id: false })
const Requirement = new mongoose.Schema({ key: String, position: String, label: String, width: Number, height: Number, codes: [String] }, { _id: false })
const Schema = new mongoose.Schema({
    company: String, email: String, packageName: String, cities: [String],
    fundingType: { type: String, enum: ['paid', 'courtesy'], default: 'paid' },
    courtesySponsor: { type: mongoose.Schema.Types.ObjectId, ref: 'Patrocinador' },
    courtesyGrantedBy: mongoose.Schema.Types.ObjectId, courtesyGrantedAt: Date, courtesyReason: String,
    courtesyRevokedAt: Date, courtesyRevokedBy: mongoose.Schema.Types.ObjectId,
    positions: [String], start: String, end: String, due: String, cents: Number,
    terms: String, expires: Date, tokenHash: String,
    accepted: Date, representative: String, document: String,
    customerId: String, paymentId: String, paymentUrl: String,
    paymentStatus: String, paymentAttempt: Date, paymentVerifiedAt: Date, paymentReceivedAt: Date,
    portalVersion: Number, durationDays: { type: Number, enum: [14, 28] },
    partnerAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerAccount', index: true },
    requirements: [Requirement], assets: [Asset], revision: { type: Number, default: 0 },
    reviewState: { type: String, enum: ['draft', 'pending', 'changes', 'approved'], default: 'draft', index: true },
    reviewFeedback: String, submittedAt: Date, publishedAt: Date, publishedRevision: Number,
    campaignStart: Date, campaignEnd: Date, destination: String,
    approvalHash: { type: String, select: false }, approvalExpires: Date, approvalAdmin: mongoose.Schema.Types.ObjectId, approvalStart: Date, approvalEnd: Date,
    mediaLockUntil: Date, portalPaused: { type: Boolean, default: false }, accessSentAt: Date, accessSendingUntil: Date,
    renewalRequestedAt: Date, renewalArt: { type: String, enum: ['keep', 'new'] }
}, { timestamps: true })
Schema.index({ partnerAccount: 1, createdAt: -1, _id: -1 })
Schema.index({ partnerAccount: 1, _id: -1 })
Schema.index({ reviewState: 1, _id: -1 })
Schema.index({ email: 1, portalVersion: 1, createdAt: -1 })
module.exports = mongoose.models.CommercialPartnership || mongoose.model('CommercialPartnership', Schema)
