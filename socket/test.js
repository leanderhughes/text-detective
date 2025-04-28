const testMode = require('../custom_modules/test-mode');
const Room = require('../models/Room');
const User = require('../models/User');
const Task = require('../models/Task');
const Response = require('../models/Response');
const Proficiency = require('../models/Proficiency');
const Note = require('../models/Note');
const {
    getTest,
    getProficiency,
    testComplete,
    proficiencyTimeUp,
    checkAndSaveWord,
    saveTrial,
    removeAltWord
} = require('../custom_modules/test');
const {
    getUser,
    getRoom,
    getIsTeacher,
    getUserFull,
    lang,
    checkIfUserNotThere,
    checkIfTeacherNotThere
} = require('../custom_modules/user-room');

const {updateObservationStats} = require('../custom_modules/observe');



const { Socket } = require('socket.io');
const isTestUser = require('../custom_modules/is-test-user');

async function startTest(socket,stage){
    try{
        const room = await getRoom(socket);
        const isTeacher = await getIsTeacher(socket);
        room.stage = stage;
        await room.save();
        const test = await getTest(socket);
        const proficiency = await getProficiency(socket);
        if(proficiency[0].complete){
            await testComplete(socket);
            return;
        }
        const task = await Task.findById(room.task);
        const timeLimit = task.testTimeLimit ? task.testTimeLimit*60000+3000 : 0;
        const {dateStarted} = proficiency[0];
        const timeLeft = (new Date(dateStarted).getTime()+timeLimit) - new Date().getTime();
        if(timeLeft <= 0){
            await proficiencyTimeUp(socket);
            await testComplete(socket);
            return;
        }
        const realTestLength = [...new Set(test.map(t=>t.index))].length;
        proficiency.sort((b,a)=>{return a.totalPoints - b.totalPoints;});
        if(proficiency.length > realTestLength){
            for(let i=proficiency.length-1; i>-1;i--){
                const index = proficiency[i].index;
                if(proficiency.filter(p=>p.index==index).lenth>1){
                    await proficiency[i].deleteOne({_id:proficiency[i].id});
                    proficiency.splice(i,1);
                }
            }
        }
        const userFull = await getUserFull(socket);
        socket.emit('got-test',{
            text:test.reduce((all,t)=>{
                all.push(...t.text);
                return all;
            },[]),
            answers:proficiency.reduce((answers,p)=>{         
                answers.push(...p.answers.map(a=>{//.filter(a=>!a.trans)
                    if(isTeacher || isTestUser(userFull)){
                        return a;
                    }
                    const {index,trans,inputIndex,response,spellingCorrect}=a;
                    return {index,trans,inputIndex,response,spellingCorrect};
                }));
                return answers;
            },[]),
            stage,
            timeLeft,
            isTeacher,
            userFull
        });
    }
    catch(e){
        console.log('startTest err',e);
    }
}

module.exports = function test(io,socket){

    
    socket.on('start-pretest',async()=>{
        try{
            const userNotThere = await checkIfUserNotThere(socket,'start-pretest');
            if(userNotThere){
                return;
            }
            return await startTest(socket,'pretest');        
        }
        catch(e){
            console.log('start-pretest error',e);
        }
    });

    socket.on('start-posttest',async()=>{
        try{
            const userNotThere = await checkIfUserNotThere(socket,'start-posttest');
            if(userNotThere){
                return;
            }
            return await startTest(socket,'posttest');        
        }
        catch(e){
            console.log('start-posttest error',e);
        }
    });

    socket.on('test-time-up',async(data)=>{
        try{
            const userNotThere = await checkIfUserNotThere(socket,'test-time-up');
            if(userNotThere){
                return;
            }
            socket.emit('log-message','started test-time-up');
            await checkAndSaveWord(io,socket,data,'complete','timeUp');
            await proficiencyTimeUp(socket);
            await testComplete(socket);
            socket.emit('log-message','finished test-time-up');
        }
        catch(e){
            console.log('test-time-up err',e);
        }
    })

    socket.on('finish-test',async(data=false)=>{
        try{
            const userNotThere = await checkIfUserNotThere(socket,'finish-test');
            if(userNotThere){
                return;
            }
            await checkAndSaveWord(io,socket,data,'complete');
            await testComplete(socket);
        }
        catch(e){
            console.log('test-complete err',e);
        }
    });

    socket.on('save-trial',async(name)=>{
        await saveTrial(socket,name);
    });

    socket.on('check-and-save-word',async (data)=>{
        try{
            const userNotThere = await checkIfUserNotThere(socket,'check-and-save-word');
            if(userNotThere){
                return;
            }
                  
            const userTaskStage = await checkAndSaveWord(io,socket,data);
            updateObservationStats(io,userTaskStage);

        }
        catch(e){
            console.log('check-and-save-word err',e);
        }
    });

    socket.on('remove-alt-word',async(data)=>{

        return await removeAltWord(socket,data);
    });

    socket.on('delete-records-after-test-load',async()=>{
        const isTeacher = await getIsTeacher(socket);
        if(!isTeacher){
            return;
        }
        const room = await getRoom(socket);
        const {task} = room;
        const userFull = await getUserFull(socket);
        const {username} = userFull;
        await Proficiency.deleteMany({username,task});
        await Response.deleteMany({username,task});
        await Note.deleteMany({username,task});
        await Room.deleteMany({'users.username':username,task});
        socket.emit('deleted-records-after-test-load');
        
        
    });

    socket.on('get-test-progress-for-all-users',async(data)=>{
        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                console.log('get-test-progress-for-all-users !');
                socket.emit('alert-message','get-test-progress-for-all-users: permission denied...');
                return;
            }
            const {task,users} = data;
            const profRows = [];
            const inputIndex = '';
            for(let i=0,l=users.length;i<l;i++){
                const profRow = await Proficiency.findOne({task,stage:'pretest',username:users[i]});
                if(!profRow){
                    continue;
                }
                const {username,totalPoints,pointsPossible,stage,complete,timeUp} = profRow;
                
                profRows.push({inputIndex,username,totalPoints,pointsPossible,stage,complete,timeUp});
            } 

            for(let i=0,l=users.length;i<l;i++){
                const profRow = await Proficiency.findOne({task,stage:'posttest',username:users[i]});
                if(!profRow){
                    continue;
                }
                const {username,totalPoints,pointsPossible,stage,complete,timeUp} = profRow;
                profRows.push({inputIndex,username,totalPoints,pointsPossible,stage,complete,timeUp});
            }   
            socket.emit('got-test-progress-for-all-users',{profRows});
        }
        catch(e){
            console.log('get-test-progress-for-all-users err',e);
        }
        
    });
  
    return socket;
}
