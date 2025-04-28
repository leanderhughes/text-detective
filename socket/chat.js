const testMode = require('../custom_modules/test-mode');
const Task = require('../models/Task');
const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Settings = require('../models/Settings');
const {checkIfReachedAttemptLimit} = require('../custom_modules/hub');


const bcrypt = require('bcrypt');

const escapeQuotes = require('../public/scripts/escape-quotes');
const { sendChatMessage,getRoleName,sendTeacherMessage,sendScrolledText } = require('../custom_modules/chat');

//const lookup = require('../custom_modules/get-synonyms');
const {lookupWord} = require('../custom_modules/lookup-word');
const {getRoom,getUser,lang,checkIfUserNotThere} = require('../custom_modules/user-room');
const { flattenArrayOfSets } = require('../custom_modules/deal');
const {getRandomWord,getRandomWords} = require('../custom_modules/tag');
const getExperimentalCondition = require('../custom_modules/get-experimental-condition');





function generateRole(users,manualUserindex=false){
    if(manualUserindex){
        return manualUserindex==1 ? 'detective' : 'witness';
    }
    const roles = users.map(item=>{return item.role;});
    if(!users.length){
        return Math.random() > .5 ? 'detective' : 'witness';
    }
    if(roles.includes('detective') && roles.includes('witness')){
        return 'detective';
        //return Math.random() > .5 ? 'detective' : 'witness';
    }
    return roles.includes('detective') ? 'witness' : 'detective';
}

async function createRoom(user,taskOb,experimentalCondition){
    try{
        const {task} = user;
        const room = new Room({
            task,
            timeLimit:taskOb.timeLimit*(experimentalCondition!='chat' ? 2 : 1),
            questionsPerRound:taskOb.questionCount,
            experimentalCondition,
            sequence:taskOb.sequence
        });
        await room.save();
        return room;
    }
    catch(e){
        console.log('createRoom',e);
    }
}


async function findOrCreateRoom(user,task,maxUserIndex=2){
  try{
    const {username,task,socketId} = user;//user.experimentalCondition
    const experimentalCondition = await getExperimentalCondition(username,task);
    maxUserIndex = typeof maxUserIndex == 'string' ? maxUserIndex : `users.${maxUserIndex}`;

    const status = 'open';
    //const dateCreated = {$gte:findingRoomsStarted};
    if(experimentalCondition=='note' || experimentalCondition=='read'){
        let room = await Room.findOne({
            'users.username':username, 
            task, 
            status,
            experimentalCondition
        });
        if(room){
            return room;
        }
        const taskOb = await Task.findById(task);
        // room = new Room({
        //     task,
        //     timeLimit:taskOb.timeLimit*2,
        //     questionsPerRound:taskOb.questionCount,
        //     experimentalCondition
        // });
        // await room.save();
        return createRoom(user,taskOb,experimentalCondition);
    }
    if(experimentalCondition=='chat'){
        let room = await Room.findOne({
            'users.username':user.email, 
            task, 
            status,
            experimentalCondition
        });
        if(room){
            return room;
        }        
        room = await Room.findOne({
            experimentalCondition,
            status,
            task,
            'users.1':{'$exists':false},
            'users.socketId':{$not:{$in:['']}}
        });
        if(room){
            return room;
        }        
        room = await Room.findOne({
            experimentalCondition,
            status,
            task,
            [maxUserIndex]:{'$exists':false},
            'users.socketId':{$not:{$in:['']}}
        });
        if(room){
            return room;
        }
        const taskOb = await Task.findById(task);
        // room = new Room({
        //     task,
        //     timeLimit:taskOb.timeLimit,
        //     questionsPerRound:taskOb.questionCount,
        //     experimentalCondition
        // });
        // await room.save();
        return createRoom(user,taskOb,experimentalCondition);
    }
    console.log('Unknown user.experimentalCondition',experimentalCondition);
  }
  catch(e){
    console.log('findOrCreateRoom err',e);
  }
}

function getClientIds(io,roomId){
    const clients = io.sockets.adapter.rooms.get(roomId);
    const clientIds = [];
    if(!clients){
        return clientIds;
    }
    for (const clientId of clients ) {

        //this is the socket of each client in the room.
        //const clientSocket = io.sockets.sockets.get(clientId);
   
        //you can do whatever you need with this
       // clientSocket.leave('Other Room')

       clientIds.push(clientId);
   
   }
   return clientIds
}

function getClientSockets(io,roomId){
    const clients = io.sockets.adapter.rooms.get(roomId);
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

function formatRoomUser(room,user,manualUserindex=false){

    return {
        username:user.email,
        userindex:manualUserindex ? manualUserindex-1 : room.users.length,
        socketId:user.socketId,
        role: room.experimentalCondition=='note' || room.experimentalCondition=='read'  ? 'detective' : generateRole(room.users,manualUserindex),
    }
}

async function joinRoom(socket,room){
    try{
        const rooms = await Room.find();
        rooms.forEach(r=>r.id!=room.id && socket.leave(room.id));
        socket.join(room.id);
    }
    catch(e){
        console.log('joinRoom err',e);
    }
}

async function fixRoomUserindexes(room){
    try{
        const {users} = room;
        for(let i=0,l=users.length;i<l;i++){
            if(users[i].index !== i){
                const {username} = users[i];
                await Room.updateOne({_id:room.id,'users.user':username},{'users.$.userindex':i});
            }
        }
    }
    catch(e){
        console.log('fixRoomUserindexes err',e);
    }
}

async function removeUserFromRoom(io,socket,user,room){
    if(typeof socket=='string'){
        console.log('socket string',socket);
        socket = io.sockets.sockets.get(socket);
        console.log('socket.id',socket.id);
    }
    if(typeof room == 'string'){
        room = await Room.findOne({_id:room});
    }
    if(typeof user == 'string'){
        user = await User.findOne({socketId:socket.id});
    }
    const userNotThere = await checkIfUserNotThere(socket);
    if(userNotThere){
        return;
    }
    socket.leave(room.id);
    const update = await Room.updateOne({_id:room.id},{$pull:{users:{username:user.username}}});
    console.log('update remove users.username',user.username,update);
    room = await Room.findOne({_id:room.id});
    await fixRoomUserindexes(room);
}

async function addUserToRoom(io,socket,user,room,manualUserindex=false){
    try{
        if(typeof socket=='string'){
            socket = io.sockets.sockets.get(socket);
        }
        if(typeof room == 'string'){
            room = await Room.findOne({_id:room});
        }
        if(typeof user == 'string'){
            user = await User.findOne({socketId:socket.id});
        }
        const userNotThere = await checkIfUserNotThere(socket);
        if(userNotThere){
            return;
        }
        socket.join(room.id);
        let u = room.users.find(u=>u.username==user.username);
        if(u){
            if(u.socketId==user.socketId){
                return room;
            }
            return await Room.updateOne({_id:room.id,'users.username':user.username},{$set:{'users.$.socketId':user.socketId}});
            
        }
        u = formatRoomUser(room,user,manualUserindex);
        await Room.updateOne(
            { _id: room.id }, 
            { $push: { users: u } }
        );
        room = await Room.findOne({_id:room.id});
        await fixRoomUserindexes(room);
    }
    catch(e){
        console.log('addUserToRoom err',e);
    }
}


async function sendFoundRoom(io,socket){
    try{
        if(typeof socket=='string'){
            socket = io.sockets.sockets.get(socket);
        }
        const room = await Room.findOne({'users.socketId':socket.id});
        const roomUser = room.users.find(u=>{return u.socketId==socket.id;});
        const taskId = room.task;
        const task = await Task.findById(taskId);
        const {userindex,role} = roomUser;

        
        const text = await Text.findOne(task.text);

        socket.emit('found-room',{
            userindex,
            role,
            taskId,
            text: text.text,
            chat:room.chat.filter(c=>{
                if(c.error){
                    return false;
                }
                if(c.sendTo=='teacher' && userindex==c.userindex){
                    return true;
                }
                if(c.public){
                    if(!c.sendTo || c.sendTo=='room'){
                        return true;
                    }
                    if(c.sendTo==userindex){
                        return true;
                    }
                    return false;        
                }
                if(c.action){
                    return false;
                }
                return true;
            }),
            roleName:getRoleName(socket,room)
        });

        await sendChatMessage(io,socket,`${getRoleName(socket,room)} joined`,'narration');

        socket.emit('check-hub');
    }
    catch(e){
        console.log('sendFoundRoom err',e);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function findRoom(io,socket){
    try{
        const user = await User.findOne({socketId:socket.id});
        if(!user.task){
            socket.emit('emit','check-hub');
            return;
        }

        const task = await Task.findById(user.task);

        const attemptLimitReached = await checkIfReachedAttemptLimit(socket);

        if(attemptLimitReached){
            socket.emit('log-message','attempt limit reached...');
            setTimeout(function(){
                socket.emit('emit','check-hub');
            },2000);
            return;
        }
        
        if(!task.findingRoomsStarted){
            task.findingRoomsStarted = Date.now();
            await task.save();
        }
        const timeUntilFindingRoomReset = 60*60*1000;
        if(Date.now()-task.findingRoomsStarted > timeUntilFindingRoomReset){
            task.findingRoomsStarted = Date.now();
            await task.save();
        }

        const settings = await Settings.findOne({});
        const {timeSpanToFinalizeRooms} = settings;

        const timePassedSinceStartedFinding = Date.now() - task.findingRoomsStarted;
        const timeLeftTillFinalized = timeSpanToFinalizeRooms - timePassedSinceStartedFinding;

        const stillFinalizingRooms = timeLeftTillFinalized > 0;

        const finalizationTime = 20*1000;
        const finalizationBufferTime = 10*1000;




        const experimentalCondition = await getExperimentalCondition(user.username,task.id);
        if(experimentalCondition!='chat' || !task.sequence.includes('task')){
            const room = await findOrCreateRoom(user,task);
            await addUserToRoom(io,socket,user,room);
            await delay(Math.round(Math.random()*3000));
            await sendFoundRoom(io,socket);
            return;    
        }
        const roomAlready = await Room.findOne({
            task:task.id,
            'users.username':user.username,
            status:'open'
        });
        if(roomAlready){

            //await Room.updateOne({_id:roomAlready.id,'users.username':user.username},{$set:{'users.$.socketId':socket.id}});
            await addUserToRoom(io,socket,user,roomAlready);
            await sendFoundRoom(io,socket);
            return;
        }
        const clientIds = getClientIds(io,'joining_'+task.id);
        const waitingIds = getClientIds(io,'already_joined_'+task.id);
        const totalCountDownTime = timeLeftTillFinalized+finalizationTime+finalizationBufferTime;
        if(stillFinalizingRooms && !clientIds.length){

            setTimeout(async()=>{
                const rooms = [];
                const sockets = getClientSockets(io,'joining_'+task.id);
                let foundCount = 0;
                const inc = (finalizationTime >1000 ? finalizationTime - 1000 : finalizationTime) / Math.floor(sockets.length/2);
                const innerInc = finalizationTime >1000 ? Math.round(1000/sockets.length) : 0;
            
                sockets.forEach(s=>{
                    s.join('already_joined_'+task.id);
                    s.leave('joining_'+task.id);
                });



                sockets.sort(function(a,b){return Math.random()-.5;});

                if(sockets.length==1){
                    //socket.leave(task.id);

                    const room = await findOrCreateRoom(user,task,2);
                    await addUserToRoom(io,socket,user,room);
                    await sendFoundRoom(io,socket);
                    socket.emit('alert-message',"Your chat partner has not been found yet. Please ask your teacher for help if your partner does not join soon.");
                    return;
                }

                while(sockets.length > 0){
                    const s1 = sockets.pop();
                    const s2 = sockets.pop();
                    const ss = [];
                    ss.push(s1);
                    ss.push(s2);
                    const u1 = await User.findOne({socketId:s1.id});
                    const u2 = await User.findOne({socketId:s2.id});
                    let s3 = '';
                    let u3 = '';
                    let room = await createRoom(u1,task,experimentalCondition);
                    // let room = new Room({
                    //     task,
                    //     timeLimit:task.timeLimit,
                    //     questionsPerRound:task.questionCount,
                    //     experimentalCondition
                    // });
                    //await room.save();
                    await addUserToRoom(io,s1,u1,room,1);
                    await addUserToRoom(io,s2,u2,room,2);
                    if(sockets.length==1){
                        s3 = sockets.pop();
                        ss.push(s3);
                        u3 = await User.findOne({socketId:s3.id});
                        await addUserToRoom(io,s3,u3,room,3);
                    }
                    room = await Room.findOne({_id:room.id});
                    rooms.push(room);

                    // const socketGroup = ss;
                    // await delay(inc);
                   
                    // for(let i=0,l=socketGroup.length;i<l;i++){                      
                    //     await sendFoundRoom(io,socketGroup[i]);
                    //     await delay(innerInc);                
                    // };
                    foundCount++;

                }
                //io.in(`observing_${task.id}`).emit('restart-observation');
                const me = await User.findOne({username:'hughes@mail.saitama-u.ac.jp'});
                me && me.socketId && io.in(me.socketId).emit('confirm-room-request',{rooms});
                io.in(me.socketId).emit('log-message',{rooms});

                
            },timeLeftTillFinalized);
        }

        if(!stillFinalizingRooms && !clientIds.length){

            const room = await findOrCreateRoom(user,task,2);
            
            await addUserToRoom(io,socket,user,room);
            await sendFoundRoom(io,socket);

 

        }
        if(stillFinalizingRooms){
            if(socket.rooms.has('joining_'+task.id) || socket.rooms.has('already_joined_'+task.id)){
                return;
            }

            socket.join('joining_'+task.id);
            

            socket.emit('finding-rooms',totalCountDownTime);// ? timeLeftTillFinalized + 5000 : 0);
            return;
        }
    }
    catch(e){
        console.log('findRoom err',e);
    }
}

module.exports = function chat(io,socket){

    socket.on('?',data=>{
        socket.emit('log-message',data);
    });

    
    socket.on('upr',async()=>{
        try{
            const user = await User.findOne({socketId:socket.id});
            if(!user || !user.isTeacher){
                return;
            }
            const rooms = await Room.find();
            const upr = rooms.map(r=>r.users.map(u=>u.username));
            socket.emit('log-message',{upr});
        }
        catch(e){
            console.log('upr err',e);
        }
    });

    socket.on('cids',async()=>{
        try{

            const room = await Room.findOne({'users.socketId':socket.id});
            if(!room){
                socket.emit('log-message','no room found');
                return;
            }
            socket.emit('log-message',room.id,room.users.map(u=>u.socketId));
            socket.emit('log-message','VS');

            socket.emit('log-message',{[room.id]:getClientIds(io,room.id)})

        }
        catch(e){
            console.log('cids',e);
        }
    });


    socket.on('log-to-room',async(data)=>{
        try{
            const room = await Room.findOne({'users.socketId':socket.id});
            if(!room){
                socket.emit('log-mesage','log-to-room err: !room');
                return;
            }
            io.in(room.id).emit('log-message',data);

        }
        catch(e){
            console.log('log-to-room err',e);
        }
    });

    socket.on('find-room',async()=>{
        try{
            socket.emit('log-message','find-room');
            await findRoom(io,socket);
 

        }
        catch(e){
            console.log('find-room error',e);
        }

    })

    socket.on('new-user',async()=>{
        try{
            const room = await Room.findOne({'users.socketId':socket.id});
            if(!room){
                console.log('No room for socket.id ',socket.id);
                return;
            }
            socket.to(room.id).emit('user-connected');
        }
        catch(e){
            console.log('new-user err',e);
        }     
    });
      
    socket.on('send-chat-message', async(data) => {
        try{
            const userNotThere = await checkIfUserNotThere(socket,'send-chat-message');
            if(userNotThere){
                return;
            }
            const narration = false;
            const {message,sendTo} = data;
            const private = sendTo == 'teacher' ? true : false;
            const action = sendTo == 'teacher' ? 'messageTeacher' : '';
            return await sendChatMessage(io,socket,message,narration, action ? {action,sendTo,private} : false);        
        }
        catch(e){
            console.log('send-chat-message err',e);
        }  
    })
    socket.on('disconnect', async() => {
        
        // getUserRooms(socket).forEach(room => {
        //   socket.to(room).emit('user-disconnected', rooms[room].users[socket.id])
        //   delete rooms[room].users[socket.id]
        // })
    
        try{

            const user = await User.findOne({socketId:socket.id});
            if(!user){

                console.log('disconnecting unknown user');
            }
            user && console.log('disconnecting ',user.username);
        
            const room = await Room.findOne({'users.socketId':socket.id});

            if(!room){
                await User.updateOne({socketId:socket.id},{socketId:''});
                return;
            }
            const role = getRoleName(socket,room);
            await sendChatMessage(io,socket,`${role} left the game.`,'narration');
            await Room.updateMany(
                {'users.socketId':socket.id},
                {$set:{'users.$.socketId':''}}
            );
            await User.updateOne({socketId:socket.id},{socketId:''});
            

        }
        catch(e){
            console.log('disconnect err',e);
        }
    })
    socket.on('lookup-word',async(data)=>{
        try{
            const {word,index,context}=data;
            data.action='lookup';
            const wordInfo = await lookupWord(socket,word,index,context);
            await sendChatMessage(io,socket,`[looks up the word ${word} at index ${index}]`,false,data);
            wordInfo.index = index;
            socket.emit('lookup-word-result',wordInfo);
        }
        catch(e){
            console.log('lookup-word err',e);
        }
    });
    socket.on('call-teacher',async(private=false)=>{
        try{
            await sendChatMessage(io,socket,`[Calls teacher ${private ? '(privately)' : ''}]`,false,action={action:'callTeacher',private});
        }
        catch(e){
            console.log('call-teacher err',e);
        }
    });
    socket.on('send-teacher-message',async(data)=>{
        try{
            await sendTeacherMessage(io,socket,data);
            socket.emit('sent-teacher-message',data);
        }
        catch(e){
            console.log('send-teacher-message err',e);
        }
    });
    socket.on('teacher-responding-now',async(data)=>{
        try{
            const {roomId,userindex} = data;
            const room = await Room.findById(roomId);
            const user = room.users.find(u=>u.userindex==userindex);
            const socketId = user.socketId;
            io.to(socketId).emit('alert-message', 'Your teacher will be here soon!');
        }
        catch(e){
            console.log('teacher-responding-now err',e);
        }
    });
    socket.on('teacher-responding-later',async(data)=>{
        try{
            const {roomId,userindex} = data;
            const room = await Room.findById(roomId);
            const user = room.users.find(u=>u.userindex==userindex);
            const socketId = user.socketId;
            io.to(socketId).emit('alert-message', 'Sorry. Your teacher is not available right now. Please try calling again later.');
        }
        catch(e){
            console.log('teacher-responding-now err',e);
        }
    });
    socket.on('scrolled-text',async(data)=>{
        try{
            await sendScrolledText(io,socket,data);
        }
        catch(e){
            console.log('scrolled-text err',e);
        }
    });
    socket.on('get-random-words',()=>{
        const randomWords = getRandomWords();
        socket.emit('got-random-words',randomWords);
    });
    socket.on('get-random-word',(startString)=>{
        const randomWord = getRandomWord(startString);
        socket.emit('got-random-word',randomWord);
    });


    socket.on('confirm-rooms',async(data)=>{
        try{
            const {newRooms} = data;
            const roomIds = newRooms.map(r=>r.id);
            const userCount = newRooms.reduce((count,r)=>{
                count+=r.users.length;
                return count;
            },0);
            console.log('newRooms',newRooms);
            for(let i=0,l=newRooms.length;i<l;i++){
                const {id,users} = newRooms[i];
                console.log({id,users});
                if(!users.length){
                    continue;
                }
                let newRoom = '';
                if(id.match(/new/)){
                    const user = await User.findOne({socketId:users[0].socketId});
                    const taskOb = await Task.findOne({_id:user.task});
                    const experimentalCondition = await getExperimentalCondition(user.username,taskOb.id);
                    newRoom = await createRoom(user,taskOb,experimentalCondition);
                    roomIds.push(newRoom.id);
                }
                else{
                    newRoom = await Room.findOne({_id:id});
                }
                for(let z=0,c=users.length;z<c;z++){
                    const {socketId} = users[z];
                    if(!newRoom.users.find(u=>u.socketId==socketId)){
                        const oldRoom = await Room.findOne({'users.socketId':socketId});
                        await removeUserFromRoom(io,socketId,socketId,oldRoom);
                        await addUserToRoom(io,socketId,socketId,newRoom);
                    }
                }
                

            }

            const finalizationTime = 20 * 1000;
            const inc = (finalizationTime >1000 ? finalizationTime - 1000 : finalizationTime) / Math.floor(roomIds.length);
            const innerInc = finalizationTime >1000 ? Math.round(1000/userCount) : 0;

            for(let i=0,l=roomIds.length;i<l;i++){
                
                if(roomIds[i].match(/new/)){
                    continue;
                }
                const room = await Room.findOne({_id:roomIds[i]});
                const {users} = room;
                for(let z=0,c=users.length;z<c;z++){
                    const {socketId} = users[z];
                    await sendFoundRoom(io,socketId);
                    await delay(innerInc);
                }
                await delay(inc);
            }
            

        }
        catch(e){
            console.log('confirm-rooms err',e);
        }
    });

    return socket;
}

