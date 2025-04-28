const mongoose = require('mongoose');

const ProficiencySchema = new mongoose.Schema({

    username:{
        type:String,
        required:true
    },
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
    previousSectionEnd:{
        type:Number
    },
    nextSectionStart:{
        type:Number
    },
    answers:{
        type:Array,
        default:[]
    },
    totalPointsPossible:{
        type:Number,
    },
    totalPoints:{
        type:Number,
        default:0
    },
    cPoints:{
        type:Number,
        default:0
    },
    cPointsPossible:{
        type:Number,
        default:0
    },
    transPoints:{
        type:Number,
        default:0
    },
    transPointsPossible:{
        type:Number,
        default:0
    },
    pointsPossible:{
        type:Number,
    },
    points:{
        type:Number,
        default:0
    },
    dateStarted:{
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
    },
    allWrongAnswers:{
        type:Array,
        default:[]
    },
    priorAttempt:{
        type:Number,
        default:0
    }
},{
    timestamps:true
});

module.exports = ProficiencySchema;

