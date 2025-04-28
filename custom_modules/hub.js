const Room = require('../models/Room');
const Settings = require('../models/Settings');
const User = require('../models/User');


async function checkIfReachedAttemptLimit(socket){
    try{
        const user = await User.findOne({socketId:socket.id});
        const {username} = user;
        const {task} = user;
        if(!user.attemptLimit){
            user = await User.findOne({username});
        }
        if(!task){
            socket.emit('alert-message','Error: Could not find task... Try refreshing the page.');
            return false;
        }
        const previousRooms = await Room.find({'users.username':username,task,status:'closed'});
        let {attemptLimit} = user;
        attemptLimit = attemptLimit.any ? attemptLimit.any : (attemptLimit[task] ? attemptLimit[task] : 1);
        if(previousRooms.length >= attemptLimit){
            
            return true;
        }
        //console.log('a l not reached..',previousRooms.length,attemptLimit);
        return false;
    }
    catch(e){
        console.log('checkIfReachedAttemptLimit err',e);
    }
}

class Hub {
    constructor(){

    }
    async checkIfReachedAttemptLimit(socket){
        return await checkIfReachedAttemptLimit(socket);
    }
}

module.exports = new Hub();