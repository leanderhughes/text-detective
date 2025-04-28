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
const addRootFolder=  require('../custom_modules/add-root-folder');
const {getTokenFromReq} = require('../custom_modules/user-room');

const escapeQuotes = require('../public/scripts/escape-quotes');
const getExperimentalCondition = require('../custom_modules/get-experimental-condition');


router.get('/',ensureAuthenticated, async(req, res) => {

  try{
    const isTeacher = req.user.isTeacher;
    if(!isTeacher){
        res.redirect('back');
    }
    res.set('Cache-Control', 'no-store');

    const token = await getTokenFromReq(req);
    const userOb = await User.findById(req.user.id);
    const user = await addExperimentalSettingsForUser(req.user);
    res.render('data', { 
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
        defer: global
        defer: chat
        defer: data

      `
    });
  }
  catch(e){
    console.log(`router.get('/'`,e);
  }
});




module.exports = router;