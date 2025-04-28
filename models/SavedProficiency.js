const mongoose = require('mongoose');

const ProficiencySchema = require('./ProficiencySchema');
const SavedProficiency = mongoose.model('SavedProficiency',ProficiencySchema);

module.exports = SavedProficiency;

