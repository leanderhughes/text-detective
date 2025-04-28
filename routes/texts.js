const express = require('express');
const router = express.Router();
const {ensureAuthenticated} = require('../config/auth');
const Text = require('../models/Text');
const Response = require('../models/Response');
const Task = require('../models/Task');
const escapeQuotes = require('../public/scripts/escape-quotes');
const {getQuestionsError} = require('../custom_modules/question-response');
const { filterFormat,getPosInOrder } = require('../custom_modules/tag');
const addRootFolder=  require('../custom_modules/add-root-folder');
const {getTokenFromReq} = require('../custom_modules/user-room');
const getExperimentalCondition = require('../custom_modules/get-experimental-condition');


router.get('/',ensureAuthenticated,async(req,res)=>{
    try{
        const texts = await Text.find();
        res.set('Cache-Control', 'no-store');
        const token = await getTokenFromReq(req);
        res.render('texts',{
            name:req.user.name,
            username: req.user.email,
            token,
            isTeacher:req.user.isTeacher,
            texts:texts,
            scripts:`
                https://cdn.quilljs.com/1.3.6/quill.js
                quill-extensions
                show-message
                text-display
            `
        });
    }
    catch(e){
        console.log('db error',e);
    }
});

router.post('/',ensureAuthenticated,async(req,res)=>{
    if(!req.user.isTeacher){
        res.redirect(addRootFolder('/texts'));
        return;
    }
    try{
        const textData = JSON.parse(req.post('text'));
        const alreadyExists = await Text.findOne({text:textData});
        if(alreadyExists){
            req.flash('error_msg','Text already exists.');
            req.sesh('text',req.post('text'));
            res.redirect(addRootFolder('/texts'));
            return;
        }
        const text = new Text({
            text: textData,
            pos:getPosInOrder(filterFormat(textData)),
            title: req.post('title'),
            creator: req.user.email,
            keywords: req.post('keywords') && req.post('keywords').trim() ? req.post('keywords').trim().replace(/ /g,'').split(',') : []
        });
        await text.save();
        const task = new Task({text:text.id});
        if(!req.post('ignoreWarnings')){
            
            const error = await getQuestionsError(task);
            if(error){
                console.log('text error');
                await text.remove();
                req.flash('error_msg',error);
                res.redirect(addRootFolder('/texts'));
                return;
            }
        }
        const errorAgain = await getQuestionsError(task);
        console.log('going to text, !ignoreWarnings',!req.post('ignoreWarnings'),'errorAgain',errorAgain);
        res.redirect(addRootFolder(`/texts/${text.id}`));
        return;
    }
    catch(e){
        console.log('db error ',e);
    }
    res.redirect(addRootFolder('/texts'));
});



router.get('/:id',ensureAuthenticated,async(req,res)=>{
    try{
        const text = await Text.findById(req.got('id'));
        if(!text){
            res.redirect(addRootFolder('/texts'));
            return;
        }
        res.set('Cache-Control', 'no-store');
        const hasResponses = !!(await Response.findOne({text:text.id}));
        const username = req.user.email;
        const token = await getTokenFromReq(req);
        console.log('routes text, username = '+username);
        res.render('texts',{
            name:req.user.name,
            username,
            token,
            hasResponses,
            isTeacher:req.user.isTeacher,
            text: JSON.stringify(escapeQuotes(text.text)),
            title: text.title,
            scripts:`

                https://cdn.quilljs.com/1.3.6/quill.js
                quill-extensions
                show-message
                text-display
                defer: analyze-output-logs
            `
        });
        return;
    }
    catch(e){
        console.log('db error ',e);
    }
    res.redirect(addRootFolder('/texts'));
});

router.put('/:id',async(req,res)=>{
    if(!req.user.isTeacher){
        res.redirect(addRootFolder('/texts'));
        return;
    }
    let text;
    try{
        const response = await Response.findOne({text:req.params.id});
        const textData = JSON.parse(req.post('text'));
        text = await Text.findById(req.params.id);
        if(response){
            req.flash('error_msg',"This text cannot be edited because responses already exist for it.");
            res.redirect(addRootFolder(`/texts/${text.id}`));
            return;
        }
        text.text = textData;
        text.title = req.post('title');
        await text.save();
        req.flash('success_msg',"Text updated.");
        res.redirect(addRootFolder(`/texts/${text.id}`));
        return;
    }
    catch(e){
        console.log('error',e);
        if(text){
            req.flash('error_msg',"Could not update text.");
            res.redirect(addRootFolder(`/texts/${text.id}`));
            return;
        }
        req.flash('error_msg',"Could not find text. " +req.params.id);
        res.redirect(addRootFolder('/texts'));
    }
});

router.delete('/:id',async (req,res)=>{
    if(!req.user.isTeacher){
        res.redirect(addRootFolder('/texts'));
        return;
    }
    let text;
    try{
        text = await Text.findById(req.got('id'));
        text.remove();
        res.redirect(addRootFolder('/texts'));
    }
    catch{
        if(text){
            req.flash('error_msg',"Could not remove text.");
        }
        res.redirect(addRootFolder('/texts'));
    }
});

module.exports = router;