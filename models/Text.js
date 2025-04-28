const mongoose = require('mongoose');

const TextSchema = new mongoose.Schema({
    creator:{
        type:String,
        required:true
    },
    title:{
        type:String,
        required:true
    },
    text:{
        type:Array,
        required:true
    },
    dateCreated:{
        type:Date,
        default:Date.now()
    },
    dateUpdated:{
        type:Date,
        default:Date.now()
    },
    keywords:{
        type:Array,
        default:[]
    }
});

const Text = mongoose.model('Text',TextSchema);

module.exports = Text;
