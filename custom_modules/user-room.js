const User = require('../models/User');
const Room = require('../models/Room');
const addRootFolder = require('../custom_modules/add-root-folder');
const cloneData = require('./clone-data'); 
const bcrypt = require('bcrypt');

async function getRoom(socket){
    try{
        const room = await Room.findOne({'users.socketId':socket.id});
        return room;
    }
    catch(e){
        console.log('getRoom err',e);
    }
}

async function getUser(socket){
    try{
        const room = await getRoom(socket);
        if(!room){
            return;
        }
        const user = room.users.find(u=>u.socketId==socket.id);
        return user;
    }
    catch(e){
        console.log('getUser err',e);
    }
}

async function getUserFull(socket){
    try{
        const userFromRoom = await getUser(socket);
        if(!userFromRoom){
            return;
        }
        const user = await User.findOne({email:userFromRoom.username});        
        const cloned = userFromRoom;//cloneData(userFromRoom,'delete id');
        for(let key in cloned){
            if(user[key]){
                continue;
            }
            user[key] = cloned[key];
        }
        return user;
    }
    catch(e){
        console.log('getUserFull err',e);
    }
}

async function getIsTeacher(socket){
    try{
        const user = await getUserFull(socket);
        if(!user){
            return;
        }
        return user.isTeacher;
    }
    catch(e){
        console.log('getIsTeacher err',e);
    }
}

async function getTokenFromReq(req){
    try{
        if(!req.user || !req.user.id){
            return '(no user id)';
        }
        const token = await bcrypt.hash(Date.now()+req.user.id,10);
        await User.updateOne({_id:req.user.id},{token});
        return token;
    }
    catch(e){
        console.log('user-room: getTokenFromReq err',e);
    }
}

async function getLanguage(socketUserObOrUsername){
    try{
        const defaultLanguage = 'jp';
        let socket = '';
        let username = '';
        if(typeof socketUserObOrUsername == 'string'){
            username = socketUserObOrUsername;
        }
        if(socketUserObOrUsername.username){
            username = socketUserObOrUsername.username;
        }
        if(username){
            const user = await User.findOne({username});
            if(!user){
                return defaultLanguage;
            }
            return user.language;
        }
        const user = await User.findOne({socketId:socket.id});
        if(!user){
            return defaultLanguage;
        }
        return user.language;
    }
    catch(e){
        console.log('user-room getLanguage err',e);
    }
}

async function checkIfUserNotThere(socket,msg=false){
    try{
        if(!socket || !socket.id){
            console.log('checkIfUserNotThere -> no socket',{socket},'msg',msg);
            return true;
        }
        function redirect(){
            socket && socket.emit && socket.emit('log-message','checkIfUserNotThere redirect msg',msg);
            console.log('checkIfUserNotThere redirect msg',msg);
            !socket || !socket.emit && console.log('checkIfUserNotThere !socket.emit');
            socket && socket.emit && socket.emit('alert-and-go-to',{
                message:'Error: Connection failed... Please try refreshing the page.',
                url:'#task'//addRootFolder('/users/logout')
            });
        }
        const userThere = await User.findOne({socketId:socket.id});
        if(!userThere){
            redirect();
            return true;
        }
        return false;
    }
    catch(e){
        console.log('checkIfUserNotThere err',e);
    }
}

class UserRoom {
    constructor(){

    }
    async getFullUser(socket){
        return await getFullUser(socket);
    }
    async getUser(socket){
        return await getUser(socket);
    }
    async getUserFull(socket){
        return await getUserFull(socket);
    }
    async getRoom(socket){
        return await getRoom(socket);
    }
    async getIsTeacher(socket){
        return await getIsTeacher(socket);
    }
    async getTokenFromReq(req){
        return await getTokenFromReq(req)
    }
    async getLanguage(socketUserObOrUsername){
        return await getLanguage(socketUserObOrUsername);
    }
    async lang(socketUserObOrUsername,en,jp){
        try{
            const l = await getLanguage(socketUserObOrUsername);
            return l == 'en' ? en : jp;
        }
        catch(e){
            console.log('user-room lang err',e);
        }
    }
    async checkIfUserNotThere(socket,msg=false){
        try{
            return await checkIfUserNotThere(socket,msg);    
        }
        catch(e){
            console.log('checkIfUserNotThere err',e);
        }

    }
    async checkIfTeacherNotThere(socket){
        try{

            if(!socket || !socket.id || !socket.emit){
                console.log('checkIfUserNotThere -> no socket',{socket});
                return true;
            }
            const userThere = await User.findOne({socketId:socket.id});
            if(!userThere){
                console.log('!userThere');
                socket.emit('alert-and-go-to',{
                    message:'Error: Connection failed... Please try refreshing the page.',
                    url:addRootFolder('/users/logout')
                });
                return true;
            }
            const user = await User.findOne({socketId:socket.id});
            if(!user.isTeacher){
                console.log('!user.isTeacher');
                socket.emit('alert-and-go-to',{
                    message:'Error: Connection failed... Please try refreshing the page.',
                    url:addRootFolder('/users/logout')
                });
                return true;
            }
            return false;
        }
        catch(e){
            console.log('checkIfTeacherNotThere err',e);
        }
    }
}

module.exports = new UserRoom();