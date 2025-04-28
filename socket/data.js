const testMode = require('../custom_modules/test-mode');
const Task = require('../models/Task');
const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Test = require('../models/Test');
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
const dbOb = {
    Task,
    Text,
    Room,

    User,
    Survey,
    SurveyResponse,

    Settings,
    Proficiency,
    SavedProficiency,
    SavedResponse,
    Note,
    Question,
    Response,
    Test

}



module.exports = function surveys(io,socket){

    socket.on('get-update-test',()=>{
        socket.emit('got-update-test',{gotIt:true});
    });
  

    // socket.on('data-socket-login',async(data)=>{
    //     try{
    //         const {token} = data;
    //         let user = await User.findOne({token});
    //         if(!user){
    //             socket.emit('alert-message','Login error...');
    //             return;
    //         }
    //         const {isTeacher} = user;
    //         if(!isTeacher){
    //             socket.emit('alert-message','Not teacher...');
    //             return;            
    //         }
    //         user.token = '';
    //         user.socketId = socket.id;
    //         user.save();
    //         socket.emit('data-login-complete');

    //     }
    //     catch(e){
    //         console.log('e err',e);
    //     }
    // });

    socket.on('execute-code',async(data)=>{
        try{
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
                return;
            }
            const {model,action,where,set} = data;
            for(let key in where){
                if(where[key] && typeof where[key]=='string' && where[key].match(/\*/)){
                    where[key] = new RegExp(where[key]);
                }
            }
            const results = [];
            const queries = [];
            for(let i=0,l=model.length;i<l;i++){
                const mod = model[i];
                console.log('execute-code',data);
                if(action=='findOne' || action=='find'){
                    const whichmod = dbOb[mod];
                    console.log({mod,action,where,set});
                    const result = await whichmod[action](where);
                    const query = `${mod}.${action}(${JSON.stringify(where)})`;
                    results.push(result); 
                    queries.push(query);     
                    continue;
                }
                if(action=='updateOne' || action=='updateMany'){
                    const whichmod = dbOb[mod];
                    const result = await whichmod[action](where,set);
                    const query = `${mod}.${action}(${JSON.stringify(where)},${JSON.stringify(set)})`;
                    results.push(result);
                    queries.push(query);
                    continue;
                }   
                if(action=='deleteMany'){
                    const query = `${mod}.${action}(${JSON.stringify(where)})`;
                    if(where=={}){
                        results.push(null);
                        queries.push(`Empty where not allowed for this action: ${query}`);
                        continue; 
                    }
                    if(!where.username && !where.email){
                        results.push(null);
                        queries.push(`!where.username && !where.email not allowed for this action: ${query}`);
                        continue;        
                    }
                    const who = where.username || where.email;
                    if(who.slice(who.lastIndexOf('.')+1).length > 1){ 
                        results.push(null);
                        queries.push(`who.slice(who.lastIndexOf('.').length > 1 not allowed for this action: ${query}`);
                        continue;              
                    }
                    const whichmod = dbOb[mod];
                    const result = await whichmod[action](where);            
                    results.push(result);
                    queries.push(query);
                    continue;
                }
                else{
                    const query = `Unknown query: ${mod}.${action}(${JSON.stringify(where)})`;
                    queries.push(query);
                    results.push(null);
                }
            }
            data.results = results;
            data.queries = queries;
            socket.emit('code-executed',data);
        }
        catch(e){
            console.log('data-execute-code err',e);
            socket.emit('alert-message','Error (see console)');
            socket.emit('log-message',e);
            socket.emit('log-message','stringified-->'+JSON.stringify(e));
        }

    });

    socket.on('get-all-stats',async()=>{
        try{
            //console.log({socket});
            const teacherNotThere = await checkIfTeacherNotThere(socket);
            if(teacherNotThere){
               // console.log('teacher not there',{socket});
                return;
            }
            const rawUsers = await User.find({});
            const tasks = await Task.find({});
            const responses = await Response.find({});
            const proficiencies = await Proficiency.find({});
            const courses = [...new Set(rawUsers.map(u=>u.course))];
            const settings = await Settings.findOne({});
            const {experimentalSequence} = settings;
            
            const courseTasks = courses.map(c=>{
                return {
                    [c]:[...tasks.filter(t=>t.courses.includes(c)).map(t=>{
                        let {title,id,sequence} = t;
                        const defaultSequence = experimentalSequence[c] ? experimentalSequence[c] : experimentalSequence.any;
                        sequence = sequence.length ? sequence : defaultSequence;
                        return {title,id,sequence};
                    })]
                }
            });
            const users = rawUsers.map(u=>{
                const {username,course} = u;
                return {
                    username,
                    course
                };
            });
            
            socket.emit('got-all-stats',{users,courseTasks});
        }
        catch(e){
            console.log('get-courses err',e);
        }

    });

    return socket;
}

