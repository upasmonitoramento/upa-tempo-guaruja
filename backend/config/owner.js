// Bound to the existing owner's database ID; a new registration cannot acquire this protection.
const OWNER_ID = "6a1b0014d6afea9736eb1925"
const isOwner = id => String(id || "").toLowerCase() === OWNER_ID
module.exports = { isOwner }
