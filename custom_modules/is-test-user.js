const { MAX_ACCESS_BOUNDARY_RULES_COUNT } = require('google-auth-library/build/src/auth/downscopedclient');
const User = require('../models/User');

async function isTestUser(socketOrUser=false){
    if(!socketOrUser){
        return false;
    }
    function isTestU(username){
        return username.match(/hughes/) || username.match(/chat/) || username.match(/note/);
    }
    try{
        if(socketOrUser.username){
            return isTestU(socketOrUser.username);
        }
        if(socketOrUser.id){
            const socket = socketOrUser;
            const user = await User.findOne({socketId:socket.id});
            if(!user){
                return false;
            }
            return isTestU(user.username);
        }
        return false;
    }
    catch(e){
        console.log('isTestUser err');
    }
}

module.exports = isTestUser;
