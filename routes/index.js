const express = require('express');
const router = express.Router();
const {ensureAuthenticated} = require('../config/auth');
const addRootFolder=  require('../custom_modules/add-root-folder');

router.get('/',(req,res)=>{
    //res.render('dashboard',{name:req.user.name});
    res.redirect(addRootFolder('/tasks'));
});

router.get('/dashboard',ensureAuthenticated,(req,res)=>{
    //res.render('dashboard',{name:req.user.name});
    res.redirect(addRootFolder('/tasks'));
});





module.exports = router;