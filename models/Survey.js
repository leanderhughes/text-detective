const mongoose = require('mongoose');

const SurveySchema = new mongoose.Schema({
    creator:{
        type:String,
        required:true,
        default:'hughes'
    },
    collaborators:{
        type:Array,
        default:[]
    },
    title:{
        type:String,
        required:true
    },
    phase:{
        type:String
    },
    markUp:{
        type:String
    },
    items:{
        type:Object
    },
    html:{
        type:String
    },
    published:{
        type:Boolean,
        default:false     
    },
    locked:{
        type:Boolean,
        default:true
    }
});

const Survey = mongoose.model('Survey',SurveySchema);

module.exports = Survey;

