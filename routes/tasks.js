const express = require('express');
const router = express.Router();
const {ensureAuthenticated} = require('../config/auth');
const Text = require('../models/Text');
const Task = require('../models/Task');
const User = require('../models/User');
const Response = require('../models/Response');
const Note = require('../models/Note');
const Proficiency = require('../models/Proficiency');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const Settings = require('../models/Settings');
const Room = require('../models/Room');
const {getQuestionsError} = require('../custom_modules/question-response');
const addRootFolder=  require('../custom_modules/add-root-folder');
const testMode = require('../custom_modules/test-mode'); 

const savePriorAttempts = require('../custom_modules/save-prior-attempts.js');

const {getTokenFromReq} = require('../custom_modules/user-room');

const {getProficiency} = require('../custom_modules/test');
const {
    //getResponse,
    getQuestionForRole//,
    // updateRoomStats,
    // processResponse,
    // getFeedbackAndUpdateRoomStats,
    // sendRoomStats,
    // getNote,
    // getNotes,
    // updateRoomFromNote,
    // updateResponsesFromNote,
    // randomizeResponseChoiceNotes
} = require('../custom_modules/question-response');
const getExperimentalCondition = require('../custom_modules/get-experimental-condition');


router.get('/',ensureAuthenticated,async(req,res)=>{
    try{
        res.set('Cache-Control', 'no-store');
        const token = await getTokenFromReq(req);
        const user = await User.findOne({username:req.user.username});
        const tdVersion = await getExperimentalCondition(req.user.username,req.user.task ? req.user.task : false);
        let {language} = user;
        if(!language){
            language = !language ? 'jp' : 'en';
            user.language = language;
            await user.save();
        }       
        const tasks = await Task.find({archived:{$not:{$eq:true}}});
        for(let i=0,l=tasks.length;i<l;i++){
            const response = await Response.findOne({task:tasks[i]});
            tasks[i].hasResponses = !!response;
        }
        const texts = await Text.find();
        const form = new Task({title:""});

        const surveys = await Survey.find({locked:false,published:true});
        for(let i=0,l=surveys.length;i<l;i++){
            const responseComplete = await SurveyResponse.findOne({username:req.user.email,survey:surveys[i].id,complete:true});
            surveys[i].complete = responseComplete ? true : false;
        }
        surveys.sort((a,b)=>{
            return (a.title.match(/説/) ? 0 : 1)-(b.title.match(/説/) ? 0 : 1);
        });

        const {isTeacher} = req.user;
        res.render('tasks',{
            language,
            tdVersion,
            name:req.user.name,
            username:req.user.username,
            token,
            isTeacher,
            texts: texts,
            tasks:tasks.filter(t=>isTeacher || t.published && t.courses.includes(req.user.course)).reverse(),
            title:'',
            textId:'',
            form:form,
            surveys,
            scripts:`

                jquery-ui
                jquery-ui-touch-punch

                show-message
                text-display
                

                defer: global
                defer:quill
                defer:quill-extensions
                defer:chat
                defer:task
                
            `
        });
    }
    catch(e){
        console.log(`tasks router.get('/',`,e);
    }
});

async function taskAlreadyExists(req){
    try{
      
        return await Task.findOne({collaborators:req.user.email,title:req.body.title});
    }
    catch(e){
        console.log('function taskAlreadyExists err',e);
    }
}

async function getTaskData(req){
    try{
        if(req.body.courses && req.body.courses.trim()){
            req.body.courses = req.body.courses.trim().split(',');
            req.body.courses = req.body.courses.map(c=>c.trim());
        }
        let sequence = req.body.sequence ? req.body.sequence : '';
        let experimentalAssignment = [];
        if(req.body.experimentalAssignment && req.body.experimentalAssignment.trim()){
            experimentalAssignment = req.body.experimentalAssignment.replace(/ /g,'').split(',');
        }
        if(sequence && sequence.trim() && sequence.trim().match(/\w/)){
            console.log('req.body.sequence',req.body.sequence);
            sequence = sequence.trim().split(',');
            sequence = sequence.map(c=>c.trim());
        }
        else{
            
            const settings = await Settings.findOne({});
            const {experimentalSequence} = settings;
            sequence = sequence && experimentalSequence[req.body.courses[0]] ? experimentalSequence[req.body.courses[0]] : experimentalSequence.any;


        }
        req.body.testTimeLimit = req.body.testTimeLimit && typeof req.body.testTimeLimit=='string' ? req.body.testTimeLimit.trim() : req.body.testTimeLimit;
        req.body.testTimeLimit = typeof req.body.testTimeLimit=='string' ? parseFloat(req.body.testTimeLimit) : req.body.testTimeLimit;
        if(!req.body.testTimeLimit && req.body.questionCount){
            req.body.testTimeLimit = Math.ceil(req.body.questionCount*4*6*10/72);
        }
    

        const taskData = {};
        for(let key in req.body){
            taskData[key] = req.body[key];
        }
        taskData.sequence = sequence;
        taskData.experimentalAssignment = experimentalAssignment;
        taskData.creator = req.user.email;
        return taskData;
    }
    catch(e){
        console.log('getTaskData err',e);
    }
}

router.post('/',ensureAuthenticated,async(req,res)=>{
    if(!req.user.isTeacher){res.redirect('/tasks');return;};
    try{
        let sequence = [];
        if(await taskAlreadyExists(req)){
            req.flash('error_msg','A task with this title already exists.')
            res.redirect(addRootFolder(`/tasks`));
            return;
        }
        const taskData = await getTaskData(req);
        const task = new Task(taskData);


        //task.markModified('sequence');
        
        const questionsError = await getQuestionsError(task);
        if(questionsError){
            //await task.remove();

            req.flash('error_msg',questionsError);
            res.redirect(addRootFolder('/tasks'));
            return;
        }
        await task.save();

        

        
        const username = req.user.username;
        await User.updateOne({_id:req.user.id},{task:task.id});

        const room = new Room({
            users:[{socketId:req.user.socketId,username,userindex:0,role:'detective'}],
            task: task.id,
            experimentalCondition:'note'
        });
        const socket = {id:req.user.socketId};
        await room.save();

        await getProficiency(socket,'pretest');
        await getQuestionForRole(socket,room);
        await getProficiency(socket,'posttest');

        await Proficiency.deleteMany({task:task.id,username});
        await Note.deleteMany({task:task.id,username});
        await Response.deleteMany({room:room.id});
        await room.remove();

        await Proficiency

        req.flash('success_msg','Task created!');
        res.redirect(addRootFolder(`/tasks?taskCreated=1`));
        return;
    }
    catch(e){
        console.log(`tasks router.post('/' err`,e);
    }
    res.redirect(addRootFolder('/tasks'));
});

router.get('/try/:id',ensureAuthenticated,async(req,res)=>{
    if(!req.user.isTeacher){res.redirect(addRootFolder('/tasks'));return;};
    const task = req.got('id');
    const username = req.user.username;
    const priorAttempts = await savePriorAttempts({task,username});
    const user = await User.updateOne({_id:req.user.id},{task});
    res.redirect(addRootFolder('/chat/room'));
    return;

});

router.get('/observe/:id',ensureAuthenticated,async(req,res)=>{
    if(!req.user.isTeacher){res.redirect('/tasks');return;};
    await User.updateOne({_id:req.user.id},{task:req.got('id')});
    res.redirect(addRootFolder('/chat/observe'));
    return;

});


router.get('/:id',ensureAuthenticated,async(req,res)=>{
    try{


        if(!req.user.isTeacher){
            const user = await User.updateOne({_id:req.user.id},{task:req.got('id')});
            res.redirect(addRootFolder('/chat/room'));
            return;
        };
        const response = await Response.findOne({task:req.got('id')});
        if(response){
            req.flash('error_msg','Cannot edit this task because responses already exist for it. Delete the responses first or create a new task.');
            req.redirect(addRootFolder('/tasks'));
            return;
        }
        res.set('Cache-Control', 'no-store');
        const token = await getTokenFromReq(req);
        const task = await Task.findById(req.got('id'));
        const texts = await Text.find();
        if(!task){
            res.redirect(addRootFolder('/tasks'));
            return;
        }
        texts.sort((a,b)=>{return b.title == task.title ? 1 : (a.title==task.title ? -1 : 0);});
        res.render('tasks',{
            name:req.user.name,
            username:req.user.username,
            token,
            isTeacher:req.user.isTeacher,
            task: task,
            tasks:[],
            texts:texts,
            form: task,
            scripts:`
                https://cdn.quilljs.com/1.3.6/quill.js
                quill-extensions
                show-message
            `
        });
        return;
    }
    catch(e){
        console.log(`tasks router.get('/:id' err`,e);
    }
    res.redirect(addRootFolder('/tasks'));
});

async function singleEdit(req){
    try{
        const singleEdits = {
            lock:{
                open:false
            },
            unlock:{
                open:true
            },
            publish:{
                published:true
            },
            unpublish:{
                published:false
            }
        }
        
        await Task.updateOne({_id:req.params.id},singleEdits[req.body.singleEdit]);
        if(['publish','unlock'].includes(req.body.singleEdit)){
            const task = await Task.findById(req.params.id);
            task.findingRoomsStarted = Date.now()-(24*60*60*1000);
            await task.save();
            
        }
    }
    catch(e){
        console.log('singleEdit err',e);
    }
}

router.put('/:id',ensureAuthenticated,async(req,res)=>{

    if(!req.user.isTeacher){res.redirect(addRootFolder('/tasks'));return;};
    let task;
    try{
        task = await Task.findById(req.params.id);
        if(req.body.singleEdit){
            await singleEdit(req);
            req.flash('success_msg',`Task ${req.body.singleEdit}ed.`);
            res.redirect(addRootFolder('/Tasks'))
            return;
        }

        const response = await Response.findOne({task:task.id});
        if(response){

            req.flash('error_msg',`This task cannot be edited because responses already exist. Delete the responses or create a new task.`);
            res.redirect(addRootFolder('/Tasks'))
            return;
        }

        const questionError = await getQuestionsError(req.body);
        if(questionError){
            req.flash('error_msg',questionError);

            res.redirect(addRootFolder(`/tasks/${task.id}`));
            return; 
        }

        const taskData = await getTaskData(req);
   
        await Task.updateOne({_id:req.params.id},taskData);

        req.flash('success_msg',"Text updated.");
        res.redirect(addRootFolder(`/tasks/${task.id}`));
        return;
    }
    catch(e){

        if(task){
            req.flash('error_msg',"Could not update task.");
            req.body.singleEdit ? res.redirect('/tasks') : res.redirect(`/tasks/${task.id}`);
            return;
        }
        req.flash('error_msg',"Could not find task. " +req.params.id);
        res.redirect(addRootFolder('/tasks') );
    }
});

router.delete('/:id',ensureAuthenticated,async (req,res)=>{

    if(!req.user.isTeacher){

        res.redirect('/tasks');
        return;
    }
    let task;
    try{
        const response = await Response.findOne({task:req.got('id')});
        if(response){

            req.flash('error_msg',"Could not remove task because there are already responses to it. Remove the responses first.");
            res.redirect(addRootFolder('/tasks'));
            return;
        }

        task = await Task.findById(req.got('id'));
        task.remove();
        res.redirect(addRootFolder('/tasks'));
    }
    catch(e){
        console.log('tasks router.delete err',e);
        if(task){
            req.flash('error_msg',"Could not remove task.");
        }
        res.redirect(addRootFolder('/tasks'));
    }
});

module.exports = router;


