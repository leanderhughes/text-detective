const testMode = require('../custom_modules/test-mode');
const Task = require('../models/Task');
const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const Settings = require('../models/Settings');
const Proficiency = require('../models/Proficiency');
const SavedProficiency = require('../models/SavedProficiency');
const SavedResponse = require('../models/SavedResponse');
const Note = require('../models/Note');
const Question = require('../models/Question');
const Response = require('../models/Response');
const {checkIfTeacherNotThere} = require('../custom_modules/user-room');
const {getStats} = require('../custom_modules/stats');

module.exports = function surveys(io,socket){

    socket.on('start-observation',async(data)=>{
        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                return;
            }
            const {username} = data;
            const socketId = socket.id;
            const email = username;
            const user = await User.findOne({email,socketId});
            const task = await Task.findById(user.task);
            if(!task){
                socket.emit('alert-message','No task...');
                return;
            }
            const {title} = task;
            const text = await Text.findById(task.text);
            const rooms = await Room.find({task:user.task});
            socket.join('observing_'+user.task);
            socket.emit('started-observation',{
                text:text.text,
                socketId:socket.id,
                rooms,
                task:task.id,
                title

            });
        }
        catch(e){
            console.log('start-observation err',e);
        }
    });
    socket.on('get-observation-stats',async(data)=>{
        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                return;
            }
            const {task} = data;
            let usernames = data.usernames ? data.usernames : (data.username ? [data.username] : []);
            const stats = [];
            if(!usernames.length){
                const rooms = await Room.find({task});
                for(let i=0,l=rooms.length;i<l;i++){
                    usernames.push(...rooms[i].users.map(u=>u.username));
                }
            }
            for(let i=0,l=usernames.length;i<l;i++){
                const username = usernames[i];
                const stat = await getStats({username,task});
                stats.push(stat);
            }
            socket.emit('got-observation-stats',{stats});
        }
        catch(e){
            console.log('get-observation-stats err',e);
        }
    });
    socket.on('change-room',async(data)=>{
        try{
            let {username,newRoom,oldRoom} = data;
            const user = await User.findOne({username});
            const {socketId} = user;
            oldRoom = await Room.findById(oldRoom);
            const {task,timeLimit,questionsPerRound,experimentalCondition} = oldRoom;

            newRoom = newRoom === false ? new Room({
                task,
                timeLimit,
                questionsPerRound,
                experimentalCondition
            }) : await Room.findById(newRoom);

            await newRoom.save();

            newRoom.users.push({
                username,
                userindex:newRoom.users.length,
                socketId,
                role:newRoom.users.length && newRoom.users[0].role=='witness' || experimentalCondition=='note'  || experimentalCondition=='read' ? 'detective' : 'witness'
            });

            newRoom.markModified('users');
            await newRoom.save();

            await Response.deleteMany({username,room:oldRoom.id});

            if(oldRoom.users.length == 1){
                await oldRoom.remove();
            }
            else{
                oldRoom.users = oldRoom.users.filter(u=>u.username!=username);
                oldRoom.markModified('users');
                await oldRoom.save();
            }


            const socketIds = [];
            let joined=  false;
            io.sockets.sockets.forEach(function(s) {
                if(s.id==socketId){
                    s.leave(oldRoom.id);
                    s.join(newRoom.id);
                    console.log('old room users',oldRoom.users);
                    console.log('new room users',newRoom.users);

                    joined=true;
                    
                }
            });
            console.log('joined');
            //io.in(socketId).emit('emit','find-room');
        }
        catch(e){
            console.log('change-room err',e);
        }
    });
    socket.on('finalize-new-rooms',async(data)=>{
        try{
            const {usernames} = data;
            for(let i= 0, l=usernames.length;i<l;i++){
                const {username} = usernames[i];
                const user = await User.findOne({username});
                if(!user){
                    console.log('no user found for username:',username);
                    continue;
                }
                const {socketId,task} = user; 
                io.sockets.sockets.forEach(function(s) {
                    if(s.id==socketId){
                            
                        s.emit('go-to',{
                            url: 'task/'+task
                        });                        
                    }
                });
            }

        }
        catch(e){
            console.log('finalize-new-rooms err',e);
        }
    });
    socket.on('get-names-of-users',async(data)=>{
        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                console.log('get-test-progress-for-all-users !');
                socket.emit('alert-message','get-test-progress-for-all-users: permission denied...');
                return;
            }
            const users = await User.find({username:{$in:data.users}});
            socket.emit('got-names-of-users',{
                users:users.map(u=>{
                    const {username,personalName,familyName,sid} = u;
                    return {username,personalName,familyName,sid};
                })
            });
        }
        catch(e){

            console.log('get-names-of-users err',e);
        }
    });

    socket.on('get-task-titles-for-class',async(data={})=>{
        try{
            const taskId = data.taskId ? data.taskId : false;
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                console.log('get-test-progress-for-all-users !');
                socket.emit('alert-message','get-test-progress-for-all-users: permission denied...');
                return;
            }
            const user = await User.findOne({socketId:socket.id});
            const task = await Task.findOne({_id:taskId || user.task});
            if(!task){
                socket.emit('log-message','get-task-titles-for-class: no task!');
                return;
            }
            const {courses} = task;
            if(!courses.length){
                socket.emit('log-message','get-task-titles-for-class: no courses!');
                return;
            }
            const tasks = await Task.find({courses:{$in:courses}});
            const titles = tasks.map(t=>{
                const {title,_id} = t;
                return {title,_id};
            });
            socket.emit('got-task-titles-for-class',{titles});
        }
        catch(e){
            console.log('get-task-titles-for-class err',e);
        }
        
    });

    socket.on('get-proficiency-data-for-task-stage',async(data)=>{

        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                socket.emit('alert-message','get-proficiency-data-for-task-stage: permission denied...');
                return;
            }
            const {stage} = data;
            const task = await Task.findOne({_id:data.task});
            const {courses} = task;
            const users = await User.find({course:{$in:courses}});
            const profRows = [];
            for(let i=0,l=users.length;i<l;i++){
                const {username,personalName,familyName,sid} = users[i];
                const prof = await Proficiency.findOne({
                    username,
                    task:task.id,
                    stage
                });
                if(!prof){
                    profRows.push({
                        username,
                        stage,                    
                        personalName,
                        familyName,
                        sid,
                        missing:true
                    });
                    continue;
                }
                const {totalPoints,totalPointsPossible,cPoints,cPointsPossible,transPoints,transPointsPossible,complete,timeUp,createdAt} = prof;
                profRows.push({username,personalName,familyName,sid,totalPoints,totalPointsPossible,cPoints,cPointsPossible,transPoints,transPointsPossible,complete,timeUp,createdAt,stage});
            }
            socket.emit('got-proficiency-data-for-task-stage',{profRows});
        }
        catch(e){
            console.log('get-proficiency-data-for-task-stage err',e);
        }
    });

    socket.on('get-all-proficiency-data-for-task-stage',async(data)=>{

        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                socket.emit('alert-message','get-proficiency-data-for-task-stage: permission denied...');
                return;
            }
            const {stage} = data;
            const task = await Task.findOne({_id:data.task});
            const {courses} = task;
            const users = await User.find({course:{$in:courses}});
            const profRows = [];
            for(let i=0,l=users.length;i<l;i++){
                const {username,personalName,familyName,sid} = users[i];
                const profs = await Proficiency.find({
                    username,
                    task:task.id,
                    stage
                });
                if(!profs.length){
                    profRows.push({
                        username,
                        stage,                    
                        personalName,
                        familyName,
                        sid,
                        missing:true
                    });
                    continue;
                }
                profRows.push({
                    username,personalName,familyName,sid,
                    answers: profs.reduce((as,p)=>{
                        const qIndex = p.index;
                        as.push(...p.answers.map(a=>{
                            const {index,points,response,complete} = a;
                            const trans = a.trans ? 1 : 0;
                            return {
                                index: parseFloat(`${qIndex}.${index}`),
                                points,
                                trans,
                                response,
                                complete
                            };
                        }));
                        return as;
                    },[])
                });
                //const {totalPoints,totalPointsPossible,cPoints,cPointsPossible,transPoints,transPointsPossible,complete,timeUp,createdAt} = prof;
                //profRows.push({username,personalName,familyName,sid,totalPoints,totalPointsPossible,cPoints,cPointsPossible,transPoints,transPointsPossible,complete,timeUp,createdAt,stage});
            }
            socket.emit('got-all-proficiency-data-for-task-stage',{profRows});
        }
        catch(e){
            console.log('get-proficiency-data-for-task-stage err',e);
        }
    });
    socket.on('get-proficiency-data-for-user',async(data)=>{

        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                socket.emit('alert-message','get-proficiency-data-for-task-stage: permission denied...');
                return;
            }
            const {stage,username,task} = data;
            if(!stage){
                const prof = await Proficiency.find({username,task});
                socket.emit('got-proficiency-data-for-user',{prof,username,task});
                return;
            }
            const prof = await Proficiency.find({username,task,stage});
            socket.emit('got-proficiency-data-for-user',{prof,username,task,stage});
        }
        catch(e){

        }
    });
    return socket;
}