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
const {getTokenFromReq} = require('../custom_modules/user-room');

const escapeQuotes = require('../public/scripts/escape-quotes');
const getExperimentalCondition = require('../custom_modules/get-experimental-condition');



router.get('/',ensureAuthenticated, async(req, res) => {

  try{
    res.set('Cache-Control', 'no-store');
    const isTeacher = req.user.isTeacher;
    const tdVersion = await getExperimentalCondition(req.user.username, req.user.task ? req.user.task : false);
    const title = '';
    const token = await getTokenFromReq(req);
    const userOb = await User.findById(req.user.id);
    const user = await addExperimentalSettingsForUser(req.user);
    res.render('surveys', { 
      title,
      tdVersion,
      isTeacher,
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

        defer: chat
        defer: survey
        defer:global

      `
    });
  }
  catch(e){
    console.log(e);
  }
});

router.get('/:title',ensureAuthenticated, async(req, res) => {

  try{
    res.set('Cache-Control', 'no-store');
    const title = req.got('title');
    const isTeacher = req.user.isTeacher;
    const token = await getTokenFromReq(req);
    const userOb = await User.findById(req.user.id);
    const user = await addExperimentalSettingsForUser(req.user);
    res.render('surveys', { 
      title,
      isTeacher,
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

        defer: chat
        defer: survey
        defer:global

      `
    });
  }
  catch(e){
    console.log(e);
  }
});




module.exports = router;