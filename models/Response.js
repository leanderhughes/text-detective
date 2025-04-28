const { isArray } = require('jquery');
const mongoose = require('mongoose');
const {pointsPerResponse} = require('../config_for_game/question-response');

const ResponseSchema = require('./ResponseSchema');

const Response = mongoose.model('Response',ResponseSchema);

module.exports = Response;
