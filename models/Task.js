const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    creator:{
        type:String,
        required:true
    },
    collaborators:{
        type:Array,
        default:[]
    },
    courses:{
        type:Array,
        default:[]     
    },
    sequence:{
        type:Array,
        default:[]
    },
    title:{
        type:String,
        required:true
    },
    text:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref: 'Text'
    },
    points: {
        type:Number,
        Default:100
    },
    questionCount:{
        type:Number,
        default: 3
    },
    timeLimit:{
        type:Number,
        default: 12
    },
    testTimeLimit:{
        type:Number,
        default: 10
    },
    testCompletionItemsPerSection:{
        type:Number,
        default:5
    },
    testTranslationItemsPerSection:{
        type:Number,
        default:1
    },
    open:{
        type: Boolean,
        default:false
    },
    published:{
        type: Boolean,
        default:true
    },
    archived:{
        type:Boolean,
        default: false
    },
    findingRoomsStarted:{
        type:Date
    },
    openFrom:{
        type:Date
    },
    openTill:{
        type:Date
    },
    dateCreated:{
        type:Date,
        default:Date.now()
    },
    dateUpdated:{
        type:Date,
        default:Date.now()
    },
    noWordNotes:{
        type:Boolean,
        default: true
    },
    experimentalAssignment:{
        type:Array
    }
});

const Task = mongoose.model('Task',TaskSchema);

module.exports = Task;
