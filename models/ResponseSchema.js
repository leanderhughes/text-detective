const { isArray } = require('jquery');
const mongoose = require('mongoose');
const {pointsPerResponse} = require('../config_for_game/question-response');

const ResponseSchema = new mongoose.Schema({
    question:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Question'
    },
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
    room:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Room'    
    },
    username:{
        type:String
    },
    experimentalCondition:{
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
    points:{
        type:Number,
        default:0
    },
    pointsPossible:{
        type:Number,
        default:pointsPerResponse
    },
    complete:{
        type:Boolean,
        default:false
    },
    timeUp:{
        type:Boolean
    },
    responses:{
        type:Array,
        default:[]
    },
    sectionNote:{
        type:String
    },
    choiceNotes:{
        type:Array
    },
    dateCreated:{
        type:Date,
        default:Date.now()
    },
    dateUpdated:{
        type:Date,
        default:Date.now()
    },
    priorAttempt:{
        type:Number,
        default:0
    }
});


module.exports = ResponseSchema;
