const mongoose = require('mongoose');

const TestSchema = new mongoose.Schema({

    task:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Task'
    },
    question:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Question'
    },
    response:{
        type:mongoose.Schema.Types.ObjectId,
        ref: 'Response'
    },
    stage:{
        type:String
    },
    index:{
        type:Number,
        required:true
    },
    setIndex:{
        type:Number
    },
    sectionStart:{
        type:Number
    },
    sectionEnd:{
        type:Number
    },
    setStart:{
        type:Number
    },
    setEnd:{
        type:Number
    },
    previousSectionEnd:{
        type:Number
    },
    nextSectionStart:{
        type:Number
    },
    text:{
        type:Array,
        default:[]
    },
    items:{
        type:Array,
        default:[]
    },
    dateCreated:{
        type:Date,
        default:Date.now()
    },
    dateUpdated:{
        type:Date,
        default:Date.now()
    },
    complete:{
        type:Boolean,
        default:false
    },
    timeUp:{
        type:Boolean,
        default:false
    }
});

const Test = mongoose.model('Test',TestSchema);

module.exports = Test;

