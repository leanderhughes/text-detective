const mongoose = require('mongoose');

const CheckTestSchema = new mongoose.Schema({
    task:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    title:{
        type:String,
        required:true
    }
});

const CheckTest = mongoose.model('CheckTest',CheckTestSchema);

module.exports = CheckTest;
