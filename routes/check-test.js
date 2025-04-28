const express = require('express');
const router = express.Router();

const {ensureAuthenticated} = require('../config/auth');

const User = require('../models/User');

const {getTokenFromReq,getLanguage} = require('../custom_modules/user-room');

const addRootFolder=  require('../custom_modules/add-root-folder');





router.get('/',ensureAuthenticated, async(req, res) => {

  try{
    if(!['k.imai.275@ms.saitama-u.ac.jp','hughes@mail.saitama-u.ac.jp','iwashita.c.649@ms.saitama-u.ac.jp','chat100@c.c'].includes(req.user.username)){
      res.redirect('back');
      return;
    }
    res.set('Cache-Control', 'no-store');
    const token = await getTokenFromReq(req);
  

    res.render('check-test', {
      
      name: req.user.name,
      roomName: 0,//room.id,
      username: req.user.email,
      token,
      // defer: chat
      // defer: question-response
      // defer: test
      // defer: hub
      scripts:`
        quill       
        input-emoji
        
      
        show-message
        text-display

        responsive-voice

        quill-extensions
        defer:global

        defer:check-test
        
      `
    });

  }
  catch(e){
    console.log(`router.get('/check-test'`,e);
  }
});





module.exports = router;