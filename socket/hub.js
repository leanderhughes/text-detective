const testMode = require('../custom_modules/test-mode');
const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Task = require('../models/Task');
const Response = require('../models/Response');
const Note = require('../models/Response');
const Question = require('../models/Question');
const Settings = require('../models/Settings');

const {lang,checkIfUserNotThere, checkIfTeacherNotThere} = require('../custom_modules/user-room');
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

const {checkIfReachedAttemptLimit} = require('../custom_modules/hub');
const savePriorAttempts = require('../custom_modules/save-prior-attempts');

const addRootFolder = require('../custom_modules/add-root-folder.js');


async function questionResponseComplete(socket,room){
    try{

        const user = room.users.find(u=>u.socketId==socket.id);
        const {username} = user;
        const {task} = room;

        const previousRooms = await Room.find({'users.username':username,task,status:'closed'});


        const userOb = await User.findOne({username});
        const {attemptLimit} = userOb;
        const attemptLimitForTask = attemptLimit.any ? attemptLimit.any : (attemptLimit[task] ? attemptLimit[task] : 1);

        if(previousRooms.length >= attemptLimitForTask){

            return true;
        }
    
        const questionForRole = await getQuestionForRole(socket,room);

        if(!questionForRole){
            return true;
        }
        if(questionForRole.complete){
            return true;
        }
        
        if(questionForRole.error){
            return false;
        }
        return false;
    }
    catch(e){
        console.log('questionResponseComplete err',e);
    }
}

async function pretestComplete(socket,room){
    try{
        //checkIfUserNotThere
        const proficiency = await getProficiency(socket,'pretest');
        return proficiency.length && proficiency.find(p=>p.stage=='pretest' && p.complete);
    }
    catch(e){
        console.log('pretestComplete err',e);
    }
}

async function posttestComplete(socket,room){
    try{
        const proficiency = await getProficiency(socket,'posttest');
        return proficiency.length && proficiency.find(p=>p.stage=='posttest' && p.complete);
    }

    catch(e){
        console.log('posttestComplete err',e);
    }
}

const completionChecks = {
    pretest:pretestComplete,
    task:questionResponseComplete,
    posttest:posttestComplete
}

const actions = {
    pretest:'start-pretest',
    task:'start-question-response',
    posttest:'start-posttest'
}

const { Socket } = require('socket.io');

async function recordCurrentStage(socket,room,stage){
    try{
        for(let i=0,l=room.users.length;i<l;i++){
            if(room.users[i].socketId==socket.id){
                room.users[i].currentStage=stage;
                room.markModified('users');
                await room.save();
                break;
            }
        }
    }
    catch(e){
        console.log('recordCurrentStage err',e);
    }
}

function showCompleteScreen(socket,canRetry=false){
    
    socket.emit('emit','get-completed-task');
    socket.emit('show-stage','task-complete');
    socket.emit('log-message','all complete');
    
    
}


function sendNotOpenMessage(socket){
    socket.emit('alert-message-and-go-to',{
        message:"This task is not open right now. Please contact your teacher if you would like it to be opened.",
        url:addRootFolder('/tasks')
    });
}

async function emitForAll(io,socket,data={},toEmit,toSend,forceAll=false){
    try{
        let user = await User.findOne({socketId:socket.id});
        if(!user){
            //alertMessage('Login error...');
            return;
        }      
        const {isTeacher} = user;
        
        if(!isTeacher){
            //alertMessage('Not teacher...');
            return;            
        } 
        let users = [];
        let taskId = data.taskId ? data.taskId : false;
        const task = taskId ? await Task.findById(taskId) : {};
        const courses = task.courses ? task.courses : false;
        const socketIds = [];
        io.sockets.sockets.forEach(function(s) {

            socketIds.push(s.id);
        });

        for(let i=0,l=socketIds.length;i<l;i++){
            const socketId = socketIds[i];
            if(socketId == socket.id){
                continue;
            }
            const search = {socketId};
            if(courses){
                search.course = {$in:courses};
            }
            const u = await User.findOne(search);
            if(forceAll || u){

                io.to(socketId).emit(toEmit,toSend);
            }

        }
    }
    catch(e){
        console.log('err start-task-for-all',e);
    }
}

async function startTaskForAll(io,socket,data){
    try{
        const {taskId} = data;
        await Task.updateOne({_id:taskId},{open:true});
        const toEmit = 'go-to';
        const toSend = {
            url:`tasks/${taskId}`,
            randomDelay:2000
        }
        return await emitForAll(io,socket,data,toEmit,toSend);
    }
    catch(e){
        console.log('startTaskForAll err',e);
    }
}

async function refreshForAll(io,socket,data){
    try{
        const toEmit = 'go-to';
        const toSend = {
            url:``,
            randomDelay:5000
        }
        return await emitForAll(io,socket,data,toEmit,toSend,'forceAll');
    }
    catch(e){
        console.log('startTaskForAll err',e);
    }
}


async function logOutAll(io,socket,data){
    try{
        const toEmit = 'go-to';
        const toSend = {
            url:`users/logout`,
            randomDelay:5000
        }
        return await emitForAll(io,socket,data,toEmit,toSend,'forceAll');
    }
    catch(e){
        console.log('startTaskForAll err',e);
    }
}

async function fixUserindex(room,username){
    if(room.users.length<=2){
        return room;
    }
    try{
        const {users} = room;
        let fix = false;
        for(let i=0,l=users.length;i<l;i++){
            if(users[i].userindex!=i){
                users[i].userindex = i;
                fix = true;
            }
        }
        if(fix){
            return room;
        }

        await Room.updateOne({_id:room.id},{users});
        const newRoom = await Room.findOne({_id:room.id});
        return newRoom;
    }
    catch(e){
        console.log('fixUserindex err',e);
    }
}


function getClientSockets(io,roomId=false){
    const clients = roomId ? io.sockets.adapter.rooms.get(roomId) : io.sockets.adapter.rooms.get();
    const clientSockets = [];

    if(!clients){
        return clientSockets;
    }
    for (const clientId of clients ) {

        //this is the socket of each client in the room.
        //const clientSocket = io.sockets.sockets.get(clientId);
   
        //you can do whatever you need with this
       // clientSocket.leave('Other Room')

       clientSockets.push(io.sockets.sockets.get(clientId));
   
   }
   return clientSockets;
}




module.exports = function hub(io,socket){
   
    socket.on('check-hub',async ()=>{

        ///savePriorAttempts (add to completion page for people who can attempt more than once)
        try{
            socket.emit('log-message','checking hub');
            const userNotThere = await checkIfUserNotThere(socket,'check-hub');
            if(userNotThere){
                console.log('user not there');
                socket.emit('log-message','hub-checked: user not there');
                return;
            }
            const user = await User.findOne({socketId:socket.id});
            const {task,username} = user;
            if(!task){
                socket.emit('alert-and-go-to',{
                    message:'Error: No task found...',
                    url:addRootFolder('/tasks')
                });
                socket.emit('log-message','hub-checked: no task found');
                return;
            }
            const taskOb = await Task.findById(task);
            if(!taskOb){
                socket.emit('alert-and-go-to',{
                    message:'Error: No task found...',
                    url:addRootFolder('/tasks')
                });
                socket.emit('log-message','hub-checked: no task found');
                return;
            }
            const reachedAttemptLimit = await checkIfReachedAttemptLimit(socket);
            const canRetry = !reachedAttemptLimit;
            if(reachedAttemptLimit){
                socket.emit('log-message','hub-checked: reachedAttemptLimit - from check-hub: should show complete...');
                showCompleteScreen(socket);
                return;
            }
            let room = await Room.findOne({'users.socketId':user.socketId,task}); 
            if(!room){
                if(!taskOb.open && !user.isTeacher){
                    room = await Room.findOne({'users.username':user.username,task,status:'closed'});
                    if(room){
                        socket.emit('log-message','hub-checked: showCompleteScreen (!taskOb.open && !user.isTeacher)');
                        showCompleteScreen(socket,canRetry);
                        return;
                    }
                    sendNotOpenMessage(socket,canRetry);
                    socket.emit('log-message','hub-checked: sendNotOpenMessage');
                    return;
                }
                socket.emit('emit','find-room');
                socket.emit('log-message','hub-checked:find-room');
                return;
            }
            
            room = await fixUserindex(room,username);         

            socket.emit('log-message',room);
            const settings = await Settings.findOne({});
            socket.emit('log-message',settings);
            const {experimentalSequence} = settings;
            let sequence = [];
            if(taskOb.sequence && taskOb.sequence.length){
                sequence = taskOb.sequence;
            }
            if(!sequence.length){
                sequence = experimentalSequence[room.experimentalCondition] ? experimentalSequence[room.experimentalCondition] : experimentalSequence.any;
            }

            let allComplete = true;

            for(let i=0,l=sequence.length;i<l;i++){
                const stage = sequence[i];
                if(!completionChecks[stage]){
                    console.log('Warning: !completionChecks[stage] for stage: ',stage);
                }
                const complete = await completionChecks[stage](socket,room);
                if(!complete){
                    if(!taskOb.open && !user.isTeacher){
                        sendNotOpenMessage(socket);
                        socket.emit('log-message','hub-checked: sendNotOpenMessage(socket)');
                        return;
                    }
                    allComplete = false;
                    const users = room.users;
                    const roomUser = room.users.find(u=>u.username==user.username);
                    if(!roomUser){
                        console.log('no user with socketId ',socket.id,' in users ',users.map(u=>{
                            
                            return {
                                username:u.username,
                                socketId:u.socketId
                            }
                        }));
                    }
                    const {currentStage} = roomUser;
                    const fromOtherStage = currentStage!=stage;
                    // for(let z=0,c=room.users.length;z<c;z++){
                    //     if(room.users[z].socketId==socket.id){
                    //         room.users[z].currentStage = stage;
                    //     }
                    // }
                    roomUser.currentStage = stage;
                    //room.users = users;
                    
                    await Room.updateOne({'users.socketId':socket.id},{'$set':{'users.$':roomUser}});
                    
                    room = await Room.findById(room.id);
                    //await recordCurrentStage(socket,room,stage);
                    if(stage=='task'){
                        const waitMsg = await lang(socket,'Your partner is still finishing the previous activity. Please wait a bit... (Please go ahead and study the text more while you are waiting.)',
                        `パートナーはまだテストを受けています。しばらくお待ちください。（待っている間に先に進んで本文を読み進めましょう。）`
                        );
                        const othersNotReady = room.users.find(u=>u.username!=user.username && u.currentStage && u.currentStage!=stage && u.currentStage!='waiting-for-partner');
                        if(othersNotReady){
                           
                            socket.emit('show-stage','waiting-for-partner');

                            socket.emit('alert-message-once',waitMsg);
                            socket.emit('html-message-once',{
                                message:waitMsg,
                                id:'waiting-for-partner'
                            });
                            setTimeout(function(){
                                socket.emit('emit','check-hub');
                            },5000);
                            socket.emit('log-message',`hub-checked: waiting-for-partner`)
                            //socket.emit('check-hub-until-next-stage-shown');
                            //break;
                            return;
                        }
                        if(fromOtherStage && room.users.length>1){
                            socket.emit('log-message',`hub-checked: fromOtherStage && room.users.length>1`);
                            
                            io.in(room.id).emit('log-message','roomUser '+roomUser.username+' says check-hub');
                            const clients = io.sockets.adapter.rooms.get(room.id);
                            io.in(room.id).emit('log-message',{clients});
                            io.in(room.id).emit('cancel-message',waitMsg);
                            // setTimeout(function(){
                            //io.in(room.id).emit('emit','check-hub');
                            socket.in(room.id).emit('emit','check-hub');
                           // return;
                            
                        }
                        // if(room.stage!='task'){
                        //     io.in(room.id).emit('cancel-message',waitMsg);
                        //     // setTimeout(function(){
                        //     //io.in(room.id).emit('emit','check-hub');
                        //     socket.in(room.id).emit('emit','check-hub');               
                        // }
                        
                        

                        // },2000);
                        
                        //socket.emit('emit','check-hub');
                        //break;
                                       
                    }
                    socket.emit('emit',actions[stage]);
                    socket.emit('show-stage',stage);  
                    socket.emit('log-message',`hub-checked: actions[${stage}]`);
                    //break;
                    return;
                }
                if(room.stage!='task'){

                }
            }
            if(allComplete){
                room.status = 'closed';
                await Room.updateOne({'users.socketId':socket.id},{status:'closed'});
                showCompleteScreen(socket,canRetry);
                socket.emit('log-message','hub checked: allComplete');
                return;
            }
            socket.emit('log-message','hub checked: got to end but !allComplete');
        }
        catch(e){
            socket.emit('log-message','check hub: db error');
            console.log('check-hub err',e);
        }
    });
    socket.on('try-again',async(data)=>{
        try{
            const {task} = data;
            const user = await User.findOne({socketId:socket.id});
            const {username} = user;
            await User.updateOne({socketId:socket.id},{task});
            const attemptLimitReached = await checkIfReachedAttemptLimit(socket);
            if(attemptLimitReached){
                await User.updateOne({socketId:socket.id},{task:''});
                socket.emit('alert-message','You have reached the attempt limit for this task. Please contact your teacher if you wish to try it again.');
                return;
            }
            const savedPriorAttempts = await savePriorAttempts({username,task});
            
            socket.emit('go-to',{url:addRootFolder(`/tasks/${task}`)});
        }
        catch(e){
            console.log('hub try-again err',e);
        }
    });
    socket.on('start-task-for-all',async(data)=>{
       return await startTaskForAll(io,socket,data);
    });
    socket.on('refresh-for-all',async(data)=>{
        return await refreshForAll(io,socket,data);
     });
     socket.on('log-out-all',async(data)=>{
        return await logOutAll(io,socket,data);
     });
     socket.on('log-to-all',async(data)=>{
        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                return;
            }
            io.emit('log-message',data);
        }
        catch(e){
            console.log('log-to-all err',e);
        }
     });
     socket.on('ping-hub',async()=>{
        try{
            const userNotThere = await checkIfUserNotThere(socket,'ping-hub');
            if(userNotThere){
                return;
            }
            socket.emit('log-message','hub-pinged');
        }
        catch(e){
            console.log('ping-hub err',e);
        }
     });
    return socket;
}

