const mongoose = require('mongoose');
const ProficiencySchema = require('./ProficiencySchema');


const Proficiency = mongoose.model('Proficiency',ProficiencySchema);

module.exports = Proficiency;

