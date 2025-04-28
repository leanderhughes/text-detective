const mongoose = require('mongoose');

const Grouping = new mongoose.Schema({
    rooms:{
        type:Array,
        default:[]
    }
});

const Grouping = mongoose.model('Grouping',Grouping);

module.exports = Grouping;

