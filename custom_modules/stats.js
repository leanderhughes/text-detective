const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Task = require('../models/Task');
const Test = require('../models/Test');
const Proficiency = require('../models/Proficiency');
const SavedProficiency = require('../models/SavedProficiency');
const Response = require('../models/Response');
const Question = require('../models/Question');
const {getResponses} = require('../custom_modules/question-response');
const {getProficiency,getOthersProficiency} = require('../custom_modules/test');
const {getRoom,getUser} = require('../custom_modules/user-room');

async function getStats(socketOrUsernameAndTask){
    try{
        let socket = socketOrUsernameAndTask.id ? socketOrUsernameAndTask : false;
        const user = await User.findOne(socket ? {socketId:socket.id} : {username:socketOrUsernameAndTask.username});
        const taskId = socketOrUsernameAndTask.task ? socketOrUsernameAndTask.task : user.task;
        const {username,personalName,familyName} = user;
        const search = {'users.username':username,task:taskId};
        const room = await Room.findOne(search,null,{sort:{'dateCreated':-1}});
        if(!room){
            console.log('getStats room not found for search: ',search);
            return;
        }
        const task = await Task.findById(room.task);
        const taskTitle = task.title;
        const taskPoints = room.currentPoints;
        const messagePoints = room.messagePoints;
        const answerPoints = room.currentPoints - room.messagePoints;
        const {pointsPossible} = room;
        const rawProfScores = {};
        const rawProfScoresNoTrans = {};
        const profScores = {};
        const profScoresNoTrans = {};
        const proficiency = {};
        const proficiencyNoTrans = {};
        const possibleTests = ['pretest','posttest','posttest2'];
        const properTitle = {
            pretest:'Pre-Test: ',
            posttest:'Post-Test: ',
            posttest2:'Post-Test 2: ',
            pretestposttest:'Immediate Improvement: ',
            pretestposttest2:'Long-term Improvement: '
        };
        for(let i=0,l=possibleTests.length;i<l;i++){
            const possibleTest = possibleTests[i];
            let prof = socket ? await getProficiency(socket,possibleTest,socket ? 'completeOnly' : false) : await getOthersProficiency({username,stage:possibleTest,task:room.task});
            if(!prof.length){
                continue;
            }
            const score = prof.reduce((sum,p)=>{
                sum += p.answers.reduce((sum,a)=>{
                    sum+=a.points ? a.points : 0;
                    return sum;
                },0);
                return sum;
            },0);
            const scorePossible = prof.reduce((sum,p)=>{
                sum += p.answers.length;
                return sum;
            },0);
            const scorePossibleNoTrans = prof.reduce((sum,p)=>{
                sum+= p.answers.filter(r=>!r.trans).length;
                return sum;
            },0);
            rawProfScores.pointsPossible = scorePossible;
            rawProfScoresNoTrans.pointsPossible = scorePossibleNoTrans;
            rawProfScores[possibleTest] = score;
            rawProfScoresNoTrans[possibleTest] = score;
            profScores[properTitle[possibleTest]] = Math.round(score*100/scorePossible)+'%';
            profScoresNoTrans[properTitle[possibleTest]] = Math.round(score*100/scorePossibleNoTrans)+'%';
            proficiency[possibleTest] = Math.round(score*100/scorePossible);
            proficiencyNoTrans[possibleTest] = Math.round(score*100/scorePossibleNoTrans);
        }

        Object.keys(proficiency).forEach(k=>{
            Object.keys(proficiency).forEach(p=>{
                if(!properTitle[k+p]){
                    return;
                }
                rawProfScores[k+p] = rawProfScores[p]-rawProfScores[k];
                rawProfScoresNoTrans[k+p] = rawProfScoresNoTrans[p]-rawProfScoresNoTrans[k];
                proficiency[k+p] = proficiency[p] - proficiency[k];
                profScores[properTitle[k+p]] = Math.round(proficiency[k+p]*100/proficiency[k])+'%';
                proficiencyNoTrans[k+p] = proficiencyNoTrans[p] - proficiencyNoTrans[k];
                profScoresNoTrans[properTitle[k+p]] = Math.round(proficiencyNoTrans[k+p]*100/proficiencyNoTrans[k])+'%';
            });
        })

        return {
            username,
            personalName,
            familyName,
            room:room.id,
            task:taskId,
            taskTitle,
            taskPoints,
            messagePoints,
            answerPoints,
            pointsPossible,
            profScores,
            rawProfScores,
            rawProfScoresNoTrans,
            proficiency,
            proficiencyNoTrans,
            profScoresNoTrans
        }
        
    }
    catch(e){
        console.log('getStats err',e);
    }
}

class Stats {
    constructor(){

    }
    async getStats(socketOrUsernameAndTask){
        return await getStats(socketOrUsernameAndTask);
    }
}

module.exports = new Stats();