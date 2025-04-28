const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    task:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Task'
    },
    text:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Text'
    },
    sectionString:{
        type:String
    },
    index:{
        type:Number,
        required:true
    },
    setIndex:{
        type:Number,
        required:true
    },
    setStart:{
        type:Number,
        required:true
    },
    setEnd:{
        type:Number,
        required:true
    },
    sectionStart:{
        type:Number,
        required:true
    },
    sectionEnd:{
        type:Number,
        required:true
    },
    choices:{
        type:Array
    },
    correctChoice:{
        type:String
    },
    dateCreated:{
        type:Date,
        default:Date.now()
    },
    dateUpdated:{
        type:Date,
        default:Date.now()
    },
    illegalWords:{
        type:Array,
        default:[]
    },
    exceptionWords:{
        type:Array,
        default:[]
    },
    setLemmas:{
        type:Array,
        default:[]
    },
    sectionLemmas:{
        type:Array,
        default:[]
    },
    sectionSynonyms:{
        type:Object,
        default:{}
    }
});

const Question = mongoose.model('Question',QuestionSchema);

module.exports = Question;

