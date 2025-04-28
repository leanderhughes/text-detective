const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  socketId:{
    type:String,
    required:true
  },
  sid:{
      type:String,
      required:true
  },
  username:{
      type:String,
      required:true
  },
  status:{
    type:String,
    required:true
  },
  date:{
      type:Date
  },
  complete:{
      type:Boolean,
      default:false
  },
  choices:{
      type:Array,
      default:[]
  }
});

const Game = mongoose.model('Game',GameSchema);

module.exports = Game;

