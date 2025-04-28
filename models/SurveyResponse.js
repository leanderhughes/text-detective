const mongoose = require('mongoose');

const SurveyResponseSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true
    },
    survey:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Survey'
    },
    title:{
        type:String,
        required:true
    },
    phase:{
        type:String
    },
    responses:{
        type:Array
    },
    complete:{
        type:Boolean,
        default:false
    }
});

const SurveyResponse = mongoose.model('SurveyResponse',SurveyResponseSchema);

module.exports = SurveyResponse;

