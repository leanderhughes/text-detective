const Room = require('../models/Room');
const { sendRoomStats } = require('./question-response');
const {findIllegalWords,getStringLemOverlaps,getLemmaList,returnIllegalChars} = require('./tag');
const {lang,checkIfUserNotThere} = require('./user-room');



function getWordCount(string){
    return string.trim().replace(/\W{1,100}/g,`,`).split(',').length;
}

function properCase(string){
    if(typeof string != 'string'){
        return string;
    }
    if(!string){
        return string;
    }
    return string.slice(0,1).toUpperCase() + string.slice(1);
}


async function messageError(string,userindex,room){
//return null;
   try{
    let revisedMessage = string;
    function err(message,feedback,revisedMessage){
        
        return {message,feedback,revisedMessage};
    }
    const errors = {};
    const wordErrors = await findIllegalWords(string,room.sectionLemmas,room.setLemmas,room.exceptionWords,room.illegalWords);
    let overlaps = getStringLemOverlaps(string,room.sectionLemmas,33/100,room.sectionStart);
    overlaps = overlaps ? overlaps : getStringLemOverlaps(string,room.setLemmas,5/10,room.setStart);
    if(overlaps){
        const messageShort = getWordCount(string)<10;
        errors.messageShort = messageShort ? true : false;
        errors.overlaps = overlaps;

        const wordsOnly = string.replace(/\W{1,100}/g,' ').trim().split(' ');
        const toBlank = wordsOnly.slice(overlaps[0].start-1,overlaps[0].end);
        toBlank.forEach(b=>{
            const replaceAll = new RegExp(`\\b${b}\\b`,'ig');
            revisedMessage = revisedMessage.replace(replaceAll,'___');
        });
        
        //return err(JSON.stringify(overlaps),overlaps);
    }
    if(wordErrors){
        errors.wordErrors = wordErrors;
        errors.illegalWordList = Object.values(wordErrors).filter(v=>v=='illegalWord') ? room.illegalWords.map(w=>properCase(w)) : false;
        const toBlank = Object.keys(wordErrors);
        toBlank.forEach(b=>{
            const replaceAll = new RegExp(`\\b${b}\\b`,'ig');
            revisedMessage = revisedMessage.replace(replaceAll,'___');
        });

        const illegalChars = returnIllegalChars();
        const illegalCharRegExp = new RegExp(`${illegalChars.source}{1,100}`,'gi');
        revisedMessage = revisedMessage.replace(illegalCharRegExp,'___');
    }

    if(Object.keys(errors).length){
        return err(JSON.stringify(errors),errors,revisedMessage);
    }
    return false;
   }
   catch(e){
    console.log('messageError err',e);
   }
   
}

function messageBonus(message,userindex,room){
    const lemmas = getLemmaList(message);
    const {sectionSynonyms,synonymsUsed,synonymRewards} = room;
    const synonymsInMessage = lemmas.reduce((used,lemma)=>{
        Object.values(sectionSynonyms).find(syns=>syns.includes(lemma)) && !used.includes(lemma) && used.push(lemma);
        return used;
    },[]);
    const synonymsThatGetBonus = synonymsInMessage.reduce((getBonus,lemma)=>{
        if(synonymsUsed.includes(lemma)){
            return getBonus;
        }
        const keyword = Object.keys(sectionSynonyms).find(key=>sectionSynonyms[key].includes(lemma));
        if(synonymRewards[keyword] && synonymRewards[keyword].includes(userindex)){
            return getBonus;
        }
        getBonus.push({keyword,synonym:lemma,userindex});
        return getBonus;
    },[]);
    return synonymsThatGetBonus.length ? synonymsThatGetBonus : false;
}

function convertToAmPmTime(string){
    const parts = string.trim().split(':');
    const hours = parseFloat(parts[0]);
    const ampm = hours > 12 ? 'pm' : 'am';
    const ampmHours = ampm=='pm' ? hours-12 : hours;
    return [ampmHours,parts[1]].join(':')+' '+ampm;
}

function calcLocalTime(offset) {
    // create Date object for current location
    var d = new Date();

    // convert to msec
    // subtract local time zone offset
    // get UTC time in msec
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);

    // create new Date object for different city
    // using supplied offset
    var nd = new Date(utc + (3600000*offset));


    // return time as a string
    //return "The local time for city"+ city +" is "+ nd.toLocaleString();
    return nd.toLocaleString();
}

function getAmPmTime(){
    return convertToAmPmTime(
        calcLocalTime(9)
        .split(' ')[1]
    );//For Tokyo
}

function getRoleName(socket,room=false){
    if(!room){
        return;
    }
    const user = room.users.find(u=>u.socketId==socket.id);
    if(!user){
        return;
    }
    const sameRoleUsers = room.users.filter(u=>u.role==user.role);
    if(sameRoleUsers.length==1){
        return `The ${user.role}`;
    }
    let roleIndex = 0;
    sameRoleUsers.forEach((u,i)=>{
        if(u.socketId==socket.id){
            roleIndex = i+1;
        }
    });
    return `${user.role[0].toUpperCase()+user.role.slice(1)} ${roleIndex}`;
}

async function updateChatObservation(io,room){
    try{
        const observer = 'observing_'+room.task;
        const lastChatIndex = room.chat.length-1;
        room = await Room.findById(room.id);
        io.in(observer).emit('update-chat',{
            room: room.id,
            from: lastChatIndex+1,
            lines: room.chat.slice(lastChatIndex+1),
            indexToUsername: room.users.reduce((ob,u)=>{
                ob[u.userindex] = u.username;
                return ob;
            },{})
        });
    }
    catch(e){
        console.log('updateChatObservation err',e);
    }
}



async function sendChatMessage(io,socket,message, narration=false,action=false){
    try{
        const userNotThere = await checkIfUserNotThere(socket,'sendChatMessage');
        if(userNotThere){

            return;
        }
        let room = '';

        if(action && action.roomId){
            room = await Room.findById(action.roomId);
        }

        if(!room){
            room = await Room.findOne({'users.socketId':socket.id});////////////////send-narration
        }
        
        if(!room){
            console.log('sendChatMessage no room...');
            return;
        }
        const roomId = room.id;
        
        const user  = room.users.find(item=>{return item.socketId == socket.id;});
        const userindex = narration ? narration : user.userindex;
        const role = narration ? '' : user.role;
        const now = Date.now();
        const seconds =  Math.round((now - room.chatUpdated)/1000);
        const error = (narration || action) ? false : await messageError(message,userindex,room);
        const time = getAmPmTime();
        if(action){
            const data = { role, message, userindex, time, error};
            //let socketId = action.socketId ? action.socketId : '';
            for(let key in action){
                data[key] = action[key];
            }
            await Room.updateOne({_id:roomId},{$push:{chat:data},chatUpdated:Date.now()});
            if(action.action=='messageTeacher' && action.private){
                io.in(socket.id).emit('chat-message', data);
            }
            else{
   
            }
            action.public && (action.socketId ? io.in(action.socketId).emit('chat-message', data) : io.in(room.id).emit('chat-message', data));
            await updateChatObservation(io,room);
            return;
        }
        if(error){
            await Room.updateOne({_id:roomId},{$push:{chat:{role,userindex,message,seconds,error}},chatUpdated:Date.now()});
            socket.emit('chat-message', { role, message, userindex, time, error });
            await updateChatObservation(io,room);
            message = error.revisedMessage;
            //return;
        }
        const bonus = narration || error ? false : messageBonus(message,userindex,room);
        if(!bonus){
            await Room.updateOne({_id:roomId},{$push:{chat:{role,userindex,message,time, seconds}},chatUpdated:Date.now()});
            io.in(roomId).emit('chat-message', { role, message, userindex, time });

            await updateChatObservation(io,room);
            return;
        }
        await Room.updateOne({_id:roomId},{$push:{chat:{role,userindex,message,bonus, time, seconds}},chatUpdated:Date.now()});
        io.in(room.id).emit('chat-message', { role, message, userindex, time });

        ///Modularize the below stuff if not too much of a pain in the ass...
        const aKeywordKeywords = bonus.length==1 ? `a keyword` : `keywords`;
        const aWordWords = bonus.length==1 ? 'a word' : 'words';
        const newBonusPoints = bonus.length * 20;
        const msg = await lang(socket,
            `The message ${getRoleName(socket,room).toLowerCase()} just wrote includes ${aWordWords} related to ${aKeywordKeywords} in this section. +${newBonusPoints} points!`,
            `今の手がかりはこの部分のキーワードに関連していました。+${newBonusPoints} points!`
        );
        const bonusMessage = msg;
        const {synonymsUsed,synonymRewards,pointsPossible} = room;
        let {messagePoints,currentPoints} = room;
        messagePoints+=newBonusPoints;
        currentPoints+=newBonusPoints;
        synonymsUsed.push(...Object.values(bonus).map(b=>b.synonym));
        Object.values(bonus).forEach(b=>{
            synonymRewards[b.keyword] = synonymRewards[b.keyword] ? synonymRewards[b.keyword] : [];
            synonymRewards[b.keyword].push(userindex);
        });
        
        await Room.updateOne({_id:roomId},{synonymsUsed,synonymRewards,messagePoints,currentPoints});
        await Room.updateOne({_id:roomId},{$push:{chat:{role:'',userindex:`narration`,message:bonusMessage, time, seconds}},chatUpdated:Date.now()});
        sendRoomStats(io,room);
        
        io.in(room.id).emit('chat-message', { role:'', message:bonusMessage,alertMessage:bonusMessage, userindex:`narration`, time });
        await updateChatObservation(io,room);
    }
    catch(e){
        console.log(e);
    }
    
}

async function sendTeacherMessage(io,socket,data){
    try{
        const {message,roomId,sendTo} = data;
        let socketId = '';
        const private = sendTo != 'room';
        if(private){
            const room = await Room.findById(roomId);
            const user = room.users.find(u=>u.userindex==sendTo);
            socketId = user.socketId;
        }
        await sendChatMessage(io,socket,message,'teacher',{
            action:'teacherMessage',
            public:true,
            roomId,
            sendTo,
            private,
            socketId
        });
    }
    catch(e){
        console.log('sendTeacherMessage err',e);
    }

}

async function sendScrolledText(io,socket,data){
    try{
        const {who,text} = data;
        const action = who=='user' ? 'userScroll' : 'programScroll';
        const shownOrScrolled = action=='userScroll' ? 'Scrolled to' : 'Shown'
        await sendChatMessage(io,socket,``, false,{
            action: who=='user' ? 'userScroll' : 'programScroll',
            text
        });
    }
    catch(e){
        console.log('sendScrolledText err',e);
    }
}

async function sendUserChooses(io,socket,response,questionIndex,points=0,triesLeft=0){
    return await sendChatMessage(io,socket,'',false,{
        action:'userChooses',
        response,
        questionIndex,
        points,
        triesLeft
    });
}

class Chat{

    constructor(){

    }
    async sendChatMessage(io,socket,message, narration,action=false){
        return await sendChatMessage(io,socket,message, narration,action);
    }
    async sendTeacherMessage(io,socket,message,data){
        return await sendTeacherMessage(io,socket,message,data);
    }
    getRoleName(socket,room){
        return getRoleName(socket,room);
    }
    async sendScrolledText(io,socket,data){
        return await sendScrolledText(io,socket,data);
    }
    async sendUserChooses(io,socket,response,questionIndex,points,triesLeft){
        return await sendUserChooses(io,socket,response,questionIndex,points,triesLeft);
    }

}

module.exports = new Chat();