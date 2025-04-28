const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({

    username:{
        type:String,
        required:true
    },
    task:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Task'
    },
    room:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Room'
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
    index:{
        type:Number,
        required:true
    },
    noteCount:{
        type:Number
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
    keywordIndexes:{
        type:Array,
        default:[]
    },
    contentType:{
        type:String //choice section
    },
    content:{
        type:String
    },
    note:{
        type:String,
        default:''
    },
    lastChatIndex:{
        type:Number,
        default:-1
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


module.exports = NoteSchema;

