const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const {ensureAuthenticated} = require('../config/auth');
const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Task = require('../models/Task');
const Settings = require('../models/Settings');
const addExperimentalSettingsForUser = require('../custom_modules/add-experimental-settings-for-user');
const {getTokenFromReq,getLanguage} = require('../custom_modules/user-room');
const savePriorAttempts = require('../custom_modules/save-prior-attempts.js');
// const app = express();
// const server = require('http').Server(app);
//const io = require('socket.io')(server,{cors:{origin:'*'}});
const escapeQuotes = require('../public/scripts/escape-quotes');

const addRootFolder=  require('../custom_modules/add-root-folder');
const getExperimentalCondition = require('../custom_modules/get-experimental-condition');




router.get('/room',ensureAuthenticated, async(req, res) => {

  try{
    res.set('Cache-Control', 'no-store');
    const token = await getTokenFromReq(req);
    const user = await addExperimentalSettingsForUser(req.user);
    const language = await getLanguage(req.user.email);
    const {isTeacher,isAssistant} = user;
    const settings = await Settings.findOne({});
    const recommendedFinishingTimes = settings.recommendedFinishingTimes;
    const wordNoteTime = recommendedFinishingTimes.note.word;
    const sectionNoteTime = recommendedFinishingTimes.note.section;
    const itemTimeNote = recommendedFinishingTimes.item.note;
    const itemTimeChat = recommendedFinishingTimes.item.chat;
    

    if(!req.user.task){
      res.redirect(addRootFolder('/tasks'));
      return;
    }

    const tdVersion = await getExperimentalCondition(req.user.username,req.user.task);

    res.render('room', {
      wordNoteTime,
      tdVersion,
      sectionNoteTime,
      itemTimeChat,
      itemTimeNote,
      language, 
      name: req.user.name,
      roomName: 0,//room.id,
      username: req.user.email,
      token,
      userindex: -1,//user.userindex,
      isTeacher,
      isAssistant,
      role:'none',//user.role,
      text:'[]',//JSON.stringify(escapeQuotes(text.text)),
      chat:[],//room.chat,
      scripts:`
        quill       
        input-emoji
        quill-extensions
      
        show-message
        text-display

        responsive-voice

        defer: global
        defer: chat
        defer: question-response
        defer: test
        defer: hub
        
      `
    });

  }
  catch(e){
    console.log(`router.get('/room'`,e);
  }
});



router.get('/observe',ensureAuthenticated, async(req, res) => {

  try{

    if(!req.user.isTeacher){
      res.redirect('back');
      return;
    }
    res.set('Cache-Control', 'no-store');
    const token = await getTokenFromReq(req);
    const user = await addExperimentalSettingsForUser(req.user);

    res.render('observe', { 
      name: req.user.name,
      roomName: 0,//room.id,
      username: req.user.email,
      token,
      userindex: -1,//user.userindex,
      role:'none',//user.role,
      text:'[]',//JSON.stringify(escapeQuotes(text.text)),
      chat:[],//room.chat,
      scripts:`
        quill       
        input-emoji
        quill-extensions

        show-message
        text-display

        export-table-to-csv

        defer: global
        defer: chat
        defer: question-response
        defer: test
        defer: observe
      `
    });

  }
  catch(e){
    console.log(`router.get('/observe'`,e);
  }
});



module.exports = router;