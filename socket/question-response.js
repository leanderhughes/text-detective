const testMode = require('../custom_modules/test-mode');
const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Task = require('../models/Task');
const Response = require('../models/Response');
const Question = require('../models/Question');
const Note = require('../models/Note');
const {
    getResponse,
    getQuestion,
    getQuestionForRole,
    updateRoomStats,
    processResponse,
    getFeedbackAndUpdateRoomStats,
    sendRoomStats,
    getNote,
    getNotes,
    updateRoomFromNote,
    updateResponsesFromNote,
    randomizeResponseChoiceNotes
} = require('../custom_modules/question-response');
const { sendChatMessage,getRoleName,sendUserChooses} = require('../custom_modules/chat');
const {getRoom,getUser,lang,checkIfUserNotThere} = require('../custom_modules/user-room');
const {getStats} = require('../custom_modules/stats');
const {maxTries} = require('../config_for_game/question-response.js');
const { Socket } = require('socket.io');
const {checkIfReachedAttemptLimit} = require('../custom_modules/hub');
const {updateObservationStats} = require('../custom_modules/observe');
const isTestUser = require('../custom_modules/is-test-user');

function isFirstUser(socket,room){
    if(!room){
        return false;
    }
    const users = room.users;
    const firstUserindex = users.find(u=>u.socketId).userindex;
    const userindex = users.find(u=>u.socketId==socket.id).userindex;
    return firstUserindex == userindex;
}

function messageError(string){
//return null;
    function err(message){
        return {message,feedback:string};
    }
    if(string.match(/\btext\b/)){
        return err("Word not allowed.");
    }
    return null;
}

async function getResponseFeedbackMessage(ob={ 
    socket,           
    points,
    tryAgain,
    roleName,
    correctChoice,
    timeUp
}){
    try{
        const {
            socket,
            points,
            tryAgain,
            roleName,
            correctChoice,
            timeUp
        } = ob;
        if(points){
            return await lang(socket,
                `${roleName} chose the correct word${correctChoice ? ` ("${correctChoice}")` : ''}! +${points} points!`,
                `探偵役${roleName.replace(/\D/g,'')}が正解しました。!${correctChoice ? ` ("${correctChoice}")` : ''}! +${points} points!`
            );
        }
        if(timeUp){
            return "Time Up!";
        }
        return await(
            socket,
            `${roleName} chose incorrectly` + (tryAgain ? `, but can try again.` : `... ${correctChoice ? `(The correct word was "${correctChoice}")` : ''}`),
            `探偵役${roleName.replace(/\D/g,'')}が間違えました。`+ (tryAgain ? `もう一度挑戦できます。` : `... ${correctChoice ? `（正解は"${correctChoice}"です。）` : ''}`)
        );
        
        
    }
    catch(e){
        console.log('question-response getResponseFeedbackMessage err',e);
    }
 
}

function getCurrentRoundQuestionIndex(currentQuestionIndex,currentRound,questionsPerRound){
    return currentQuestionIndex - (questionsPerRound * (currentRound-1));
}

const doneMessage = `Congratulations! You have completed this activity!`;

async function respond(io,socket,responseString,specialConditions={timeUp:false}){


    try{
        const userNotThere = await checkIfUserNotThere(socket,'respond');
        if(userNotThere){
            return;
        }
        const {timeUp}=specialConditions;
        const room = await Room.findOne({'users.socketId':socket.id});
        if(!room){

            socket.emit('alert-message','Error: No room...');
            return;
        }
        const {currentQuestionIndex} = room;
        const username =  room.users.reduce((username,u)=>{
            if(u.socketId==socket.id){
                username = u.username;
            }
            return username;
        },'');
        const task = room.task;

        if(!timeUp && room.experimentalCondition=='chat'){
            const detectiveCount = room.users.filter(u=>u.role=='detective').length;
            let currentUserIndex = -1;
            let exchangeCount = 0;
            const exchangeQuota = 2;
            const exchangeQuotaMet = room.chat.reduce((met,c)=>{
                if(c.action=='userChooses' && (c.points || !c.triesLeft) && c.questionIndex!=currentQuestionIndex){
                    //console.log('resetting exchange count',c);
                    currentUserIndex = -1;
                    exchangeCount = 0;
                    met = false;
                    return met;
                }
                if(c.action){
                    return met;
                }
                if(isNaN(c.userindex)){
                    return met;
                }
                if(!c.message || !c.message.match(/[a-zA-Z]/)){
                    return met;
                }
                if(c.userindex==currentUserIndex){
                    return met;
                }
                currentUserIndex = c.userindex;
                exchangeCount++;
                if(exchangeCount >= exchangeQuota){
                    met = true;
                }
                return met;
            },false);
            if(!exchangeQuotaMet){
                const msg = await lang(socket,
                    `At least ${exchangeQuota} chat turns must be taken before an answer may be chosen.`,
                    `回答する前に、少なくとも ${exchangeQuota}回はメッセージを交換しなければいけません。（「一方がメッセージを送って、他方が返信する」というやり取りを ${Math.ceil(exchangeQuota/2)}回分。）`
                );
                socket.emit('response-error',msg);
                //log this to chat later...
                return;
            }
        }


        const roleName = getRoleName(socket,room);
        const response = await processResponse(socket,room,responseString,specialConditions);
        if(!response){
            console.log('respond !response');
            return;
        }
        const feedback = await getFeedbackAndUpdateRoomStats(io,socket,room,response);
        const {points,tryAgain,correctChoice,next} = feedback;
        isTestUser({username}) && socket.emit('log-message',`response: ${responseString} -> points: ${points}`);

        const message = await getResponseFeedbackMessage({
            socket,
            points,
            tryAgain,
            roleName,
            correctChoice,
            timeUp
        });
        //points ? `${roleName} chose the correct word${correctChoice ? ` ("${correctChoice}")` : ''}! +${response.points} points!` : `${roleName} chose incorrectly` + (feedback.tryAgain ? `, but can try again.` : `... ${correctChoice ? `(The correct word was "${correctChoice}")` : ''}`);
        const triesLeft = maxTries-response.responses.length;
        await sendUserChooses(io,socket,responseString,currentQuestionIndex,points,triesLeft);
        const tryTries = triesLeft > 1 ? 'tries' : 'try';

        const nextMessages = {
            done:doneMessage,
            nextQuestion:`Next mystery!`,
            tryAgain:triesLeft ? `${roleName} has ${triesLeft} ${tryTries} left!` : '',
            switchRoles: await lang(socket,
                "<h2>Let's trade roles for the next set of mysteries.</h2>",
                `<h2>役割を交換して、次の謎に挑戦です。</h2>`
            )
        };
        const privateNextMessages = {
            waitForOtherDetective:`The other detective is still working on this mystery. Help them solve it!`,
        };
        const nextMessage = nextMessages[feedback.next] ?  nextMessages[feedback.next] : '';
        const privateNextMessage = privateNextMessages[feedback.next] ? privateNextMessages[feedback.next] : '';
        
        if(!privateNextMessage){
            io.in(room.id).emit('response-result',{message,nextMessage,next});
            
        }
        if(privateNextMessage){
            io.in(room.id).emit('response-result',{message,next});
            socket.emit('response-result',{
                message,
                nextMessage:privateNextMessage,
                next
            });
        }          
        await sendChatMessage(io,socket,message,'narration');
        next=='switchRoles' || next=='done' && await sendChatMessage(io,socket,nextMessage,'narration');
        // if(next=='switchRoles'){
        //     console.log('highlight-new-role');
        //     socket.emit('highlight-new-role');
        // }
        //io.in(room.id).emit('update-stats',{stats});
        sendRoomStats(io,room);
        if(next=='done'){
            //room.status = 'closed';
            //await room.save();
            // setTimeout(function(){
            //     socket.emit('check-hub');
            // },3000);
        }

        updateObservationStats(io,{username,task});
        return;
    }
    catch(e){
        console.log('respond',e);
    }

}

// async function getRoomBySocket(socket){
//     try{
//         console.log('socketId',socket.id);
//         return await Room.findOne({'users.socketId':socket.id});
//     }
//     catch{

//     }
// }

function getRoomUserBySocket(room,socket){
    return room.users.find(user=>{return user.socketId==socket.id});

}



async function getNextResponse(){
    try{

    }
    catch(e){
        console.log('db err',e);
    }
}

async function getNextQuestion(){
    try{

    }
    catch(e){
        console.log('db err',e);
    }
}

async function sendNote(io,socket,note){
  try{
    if(!note){
        return;
    }
    const userNotThere = await checkIfUserNotThere(socket,'sendNote');
    if(userNotThere){
        return;
    }
    note ? socket.emit('got-note',note) : socket.emit('got-question',questionForRole);
    // const msg = await lang(socket,
    //     `Take a note about the highlighted ${note.contentType}. This will be an important clue!`,
    //     `黄色く線が引かれている部分についてノートをとり、後で謎を解く際の際の手がかりを残しましょう。`
    // );
    const room = await Room.findOne({'users.socketId':socket.id});
    if(!room){
        socket.emit('alert-message','Error: No room found...');
        return;
    }
    const {experimentalCondition} = room;
    const tdVersion = experimentalCondition;
    const msg = await lang(socket,
        `${tdVersion=='note' ? 'Type a note in the chat box about' : 'Read and study'} the highlighted section in the text. This will be a clue to help you solve a mystery later.`,
        `黄色く線が引かれている部分${tdVersion=='note' ? 'についてノートをとり、後で謎を解く際の手がかりを残しましょう。' : 'を読んで、よく理解しましょう。後で問題を解く際の手がかりになります。'}`
        //の --> に  ? 
    );
    note && await sendChatMessage(io,socket,msg,'narration');
    note && socket.emit('alert-message',msg);
    return true;
  }
  catch(e){
    console.log('sendNote err',e);
  }
}

async function saveNote(socket,params={}){
   // console.log('save-note');
    try{
        const userNotThere = await checkIfUserNotThere(socket,'saveNote');
        if(userNotThere){
            return;
        }
        const room = await Room.findOne({'users.socketId':socket.id});
        const note = await getNote(room);
        const user = room.users.find(u=>{
            return u.socketId==socket.id
        });
        const userindex = user.userindex;
        const chat = room.chat;
        if(chat[chat.length-1] && chat[chat.length-1].error){
            return note;
        }
        let lastChatIndex = -1;
        for(let i=0,l=chat.length;i<l;i++){
            const line = chat[i];
            if(line.userindex==userindex && !line.error){
                lastChatIndex = i;
            }
        }
        if(lastChatIndex <= note.lastChatIndex){
            if(Object.keys(params).length){
                for(let key in params){
                    note[key] = params[key];
                }
                await note.save();
            }
            return note;
        }
        const lastChatOb = room.chat[lastChatIndex];
        note.lastChatIndex = lastChatIndex;
        note.note = (note.note + '\n'+lastChatOb.message).trim();
        for(let key in params){
            note[key] = params[key];
        }
        await note.save();
        return note;
    }
    catch(e){
        console.log('saveNote err',e);
    }


}

async function finalizeResponseChoiceNotes(room){
    try{
        const responses = await Response.find({room:room.id});
        if(!room){
            console.log('finalizeResponseChoiceNotes !room');
            return;
        }
        for(let i=0,l=responses.length;i<l;i++){
            const response = responses[i];
            const question = await Question.findById(responses[i].question);
            if(response.choiceNotes.length < question.choices.length){
                const keywords = response.choiceNotes.map(c=>Object.keys(c)[0]);
                const choiceNoteValues = response.choiceNotes.map(c=>Object.values(c)[0]);
                const choices = question.choices;
                const keywordOb = choices.find(c=>!keywords.includes(c.keyword));
                const keyword = keywordOb.keyword;
                const keywordNote = '[No notes taken for this word]';
                choiceNoteValues.push(keywordNote);
                keywords.push(keyword);
                response.choiceNotes.sort((a,b)=>{return Math.random() - .5;});
                response.choiceNotes.push({[keyword]:keywordNote});
                response.markModified('choiceNotes');
                //await response.save();
                await Response.updateOne({_id:response.id},{choiceNotes:response.choiceNotes});
            }
        }
        return true;
    }
    catch(e){
        console.log('finalizeResponseChoiceNotes err',e);
    }
}

function alertError(socket,message,data=false){
    if(data==false && typeof message!='string'){
        data = message;
        if(data.message){
            message = data.message;
        }
        else if(data.error && typeof data.error=='string'){
            message = data.error;
        }
        else{
            message = 'An error has occurred. Please tell your teacher.';
        }
    }
    if(!message.match(/error/i)){
        message = 'Error: '+message;
    }
    socket.emit('alert-error',{message,data});
}

async function sendQuestionRecordToChat(io,socket,room,question,delayed=false){
    try{
        if(!question){
            return;
        }
        if(!delayed){
            const user = room.users.find(u=>u.socketId==socket.id);
            const {userindex} = user;
            setTimeout(async function(){
                try{
                    if(userindex){
                        room = await Room.findById(room.id);
                    }
                    sendQuestionRecordToChat(io,socket,room,question,'delayed')
                }
                catch{

                }
            },30*userindex);
            return;
        }
        const {sectionString,choices,correctChoice} = question;
        const index = room.currentQuestionIndex;
        if(room.chat.find(c=>c.question && c.question.index==index)){
            return;
        }
        await sendChatMessage(io,socket,`[Got question ${index}: "${sectionString}" with choices "${choices.map(c=>c.keyword).join(', ')}." Correct choice: "${correctChoice}"]`,'record',{action:'got-question',question:{index,sectionString,choices,correctChoice}});
    }
    catch(e){
        console.log('sendQuestionRecordToChat err',e);
    }
}

async function sendNoteRecordToChat(io,socket,room,note){
    try{
        if(!note){
            return;
        }
        const {content,index} = note;
        if(room.chat.find(c=>c.note && c.note.index==index)){
            return;
        }
        await sendChatMessage(io,socket,`[Got note prompt ${index} for: "${content}"]`,'record',{action:'got-note',note:{index,content}});
    }
    catch(e){
        console.log('sendQuestionRecordToChat err',e);
    }
}


async function timeUp(io,socket,later=false){
    try{

        const room = await Room.findOne({'users.socketId':socket.id});
        if(!room){

            return;
        }
        const user = room.users.find(u=>u.socketId==socket.id);
        const {username,userindex} = user;
        const usersConnected = room.users.filter(u=>u.socketId);
        if(userindex && usersConnected.length>1){
            console.log(`userindex && usersConnected.length>1`,username);
            return;
        }
        const {task} = room;



        const responses = await Response.find({room:room.id});
        if((room.experimentalCondition!='chat' || room.currentRound==1) && responses[0] && responses[0].timeUp){

            return;
        }
        if(room.experimentalCondition=='chat' && responses.slice(-1).timeUp){
            console.log(`room.experimentalCondition=='chat' && responses.slice(-1).timeUp`,userindex,username,responses.slice(-1));
            return;    
        }
        const detectives = room.users.filter(u=>u.role=='detective').map(u=>u.username);
        for(let i=0,l=responses.length;i<l;i++){
            if(responses[i].complete){
                continue;
            }
            if(!detectives.includes(responses[i].username)){
                continue;
            }
            responses[i].complete = true;
            responses[i].timeUp = true;
            await responses[i].save();
        }

        if(room.experimentalCondition=='note' || room.experimentalCondition=='read'){
            const notes = await Note.find({username,task});
            for(let i=0,l=notes.length; i<l; i++){
                if(notes[i].complete){
                    continue;
                }
                notes[i].timeUp=true;
                notes[i].complete=true;
                await notes[i].save();
            }
        }
        await respond(io,socket,false,{timeUp:true});
    }
    catch(e){
        console.log('socket time-up',e);
    }
}



module.exports = function questionResponse(io,socket){

    const sesh = {};


    
    socket.on('start-question-response',async ()=>{
        try{
            const room = await Room.findOne({'users.socketId':socket.id});
            const userindex = room.users.find(u=>u.socketId==socket.id).userindex;
            setTimeout(async function(){      
                const questionForRole = await getQuestionForRole(socket,room);
                if(!questionForRole || questionForRole.complete){
                    socket.emit('got-question',{done:true,message:doneMessage});
                    return;
                }
                if(questionForRole.error){
                    alertError(socket,questionForRole.error);
                    return;
                } 
                const note = await getNote(room);
     
                isFirstUser(socket,room) && await updateRoomStats(io,room);//Hack to avoid overlapping room saves
                if(!room.currentQuestionIndex && userindex){
                    await new Promise(resolve => setTimeout(resolve, userindex*300));
                }
                
                if(note){
                    await updateRoomFromNote(room,note);
                    await sendNoteRecordToChat(io,socket,room,note);
                    await sendNote(io,socket,note);   
                }

                if(!note){
                    const question = await getQuestion(socket,room);
                    await sendQuestionRecordToChat(io,socket,room,question);
                    socket.emit('got-question',questionForRole);
                }
                sendRoomStats(io,room);
            },userindex*1000+(Math.random()*1000));//Hack to avoid overloading server and creating duplicate questions
        }
        catch(e){
            console.log('db error',e);
        }
    });
    socket.on('respond',async(responseString)=>{
        await respond(io,socket,responseString);
    });
    socket.on('save-note',async()=>{
        await saveNote(socket);
    });
    socket.on('finish-note',async()=>{
        try{
            const room = await Room.findOne({'users.socketId':socket.id});
            const noteBeforeSave = await getNote(room);
            if(room.experimentalCondition=='note'){
                if(!noteBeforeSave || !noteBeforeSave.note){
                    const msg = await lang(socket,
                        "You have not entered anything for this note yet. Please enter your note before continuing.",
                        "何も手がかりがありません。次に進む前に何か入力しましょう。"
                    );
                    socket.emit('alert-message',msg);
                    return;
                }     
            }
            const savedNote = await saveNote(socket,{complete:true});
            await updateResponsesFromNote(savedNote);
            const note = await getNote(room);
            if(!note){
                room.experimentalCondition=='note' || room.experimentalCondition=='read' && await finalizeResponseChoiceNotes(room);
                socket.emit('notes-complete');
                return;
            }   
            await updateRoomFromNote(room,note);
            socket.emit('got-note',note);
            await sendNoteRecordToChat(io,socket,room,note);
            await sendNote(io,socket,note);
            //sendRoomStats(io,room);
        }
        catch(e){
            console.log('finish-note err',e);
        }
    });
    socket.on('time-up',async()=>{
        try{
            await timeUp(io,socket);
        }
        catch{

        }
    });
    socket.on('get-question',async()=>{
        try{
            
            const userNotThere = await checkIfUserNotThere(socket,'get-question');
            if(userNotThere){
                return;
            }
            const userOb = await User.findOne({socketId:socket.id});
            const {username} = userOb;
            const room = await Room.findOne({'users.socketId':socket.id});
            if(!room){
                console.log('!room for',username);
                socket.emit('log-message','room lost... refreshing');
                socket.emit('alert-and-go-to',{
                    message:'Error: Connection failed... Please try refreshing the page.',
                    url:'#task'//addRootFolder('/users/logout')
                });
                return;
            }
            const user = room.users.find(u=>u.socketId==socket.id);
            const questionForRole = await getQuestionForRole(socket,room);
            if(!room.currentQuestionIndex){
                console.log(user.username,' waiting for ',100*user.userindex);
                await new Promise(resolve => setTimeout(resolve, 100*user.userindex));
            }
            await updateRoomStats(io,room);
            const question = await getQuestion(socket,room);
            await sendQuestionRecordToChat(io,socket,room,question);
            socket.emit('got-question',questionForRole);
        }
        catch(e){
            console.log('get-question err',e);
        }
    });
    socket.on('get-round-ends',async()=>{
        try{
            const room = await Room.findOne({'users.socketId':socket.id});
            const {roundEnds} = room;
            if(!roundEnds){
                return;
            }
            socket.emit('got-round-ends',new Date(roundEnds).getTime());
        }
        catch(e){
            console.log('db error',e);
        }
    });
    socket.on('test',()=>{
        console.log('test by ',socket.id);
    });

    socket.on('get-completed-task',async()=>{
        try{
            const user = await User.findOne({socketId:socket.id});
            const attemptLimitReached = await checkIfReachedAttemptLimit(socket);
            const canRetry = !attemptLimitReached;
            const stats = await getStats(socket);
          //  const task = await Task.findById(user.task);
            const rooms = await Room.find({'users.username':user.username,task:user.task}).sort({dateCreated:-1}).limit(1);
            if(!rooms.length){
                console.log('no room for ',user.username,user.task);
                return;
            }
            const room = rooms[0];

            let roomId = '';
            let feedback = '';
            let funInteresting = '';
            let improvedEnglish = '';
            let partners = [];
        
            if(room){
                roomId = room.id;
                const feedbackOb = room.feedback.find(f=>f.username==user.username);
                const partnerUsers = room.users.filter(u=>u.username!=user.username);
                console.log('partnerUsers',partnerUsers);
                if(partnerUsers.length){
                    const partnerUsernames = partnerUsers.map(p=>p.username);
                    const otherUsers = await User.find({username:{$in:partnerUsernames}});
                    partners = otherUsers.map(o=>o.personalName+' '+o.familyName);
                }
                feedback = feedbackOb ? feedbackOb.feedback : '';
                funInteresting = feedbackOb ? feedbackOb.funInteresting : '';
                improvedEnglish = feedbackOb ? feedbackOb.improvedEnglish : '';
            }
            socket.emit('alert-message',`Congratulations! You have completed the task "${stats.taskTitle}".`);
            socket.emit('got-completed-task',{
                stats,
                room:roomId,
                task:user.task,
                feedback,
                funInteresting,
                improvedEnglish,
                canRetry,
                partners
                
            });
            await User.updateOne({socketId:socket.id},{'$unset':{task:''}});
        }
        catch(e){
            console.log('get-completed-task err',e);
        }
    });
    socket.on('submit-task-feedback',async(data)=>{///This is messed up.
        try{
            console.log('submit-task-feedback',{data});
            const msg = "Thank you for your feedback";
            const user = await User.findOne({socketId:socket.id});
            const {username} = user;
            let {feedback,room,silent} = data;
            if(silent){
                console.log(user,'still submitting feedback silently. Check it out!');
                return;
            }
            console.log({feedback,room,silent});

            room = await Room.findById(room);
            if(!room){
                console.log('submit-task-feedback: no room for',username);
                return;
            }

            console.log('room.feedback',room.feedback,'room.feedback.length',room.feedback.length,'username',username);
            for(let i=0,l=room.feedback.length;i<l;i++){
                if(room.feedback[i].username==username){
                    // room.feedback[i].feedback = feedback;
                    // room.markModified('feedback');
                    // await room.save();   

                    console.log('about to update in loop');

                    const res = await Room.updateOne({_id:room.id,'feedback.username':username},{'feedback.$.feedback':feedback});
                    console.log('update result',res);
                    
                    !silent && socket.emit('alert-and-go-to',{msg,url:'#main'});
                    return;
                }
            }
            console.log('about to update outside of loop');
            room.feedback.push({username,feedback});
            const res2 = await Room.updateOne({_id:room.id},{feedback:room.feedback});
            console.log('res2',res2);
            !silent && socket.emit('alert-and-go-to',{msg,url:'#main'});
        }
        catch(e){
            console.log('submit-task-feedback err',e);
        }
    });

    socket.on('submit-likert-task-feedback',async(data)=>{
        try{
            let {field,value,room} = data;
            const user = await User.findOne({socketId:socket.id});
            const {username} = user;
            room = await Room.findById(room);
            for(let i=0,l=room.feedback.length;i<l;){
                if(room.feedback[i].username==username){
                    room.feedback[i][field] = value;
                    room.markModified('feedback');
                    await room.save();        
                    return;
                }
            }
            room.feedback.push({username,[field]:value});
            room.markModified('feedback');
            await room.save();
        }
        catch(e){
            console.log('submit-likert-task-feedback err',e);
        }
    });

    return socket;
}