const Text = require('./models/Text');
const Room = require('./models/Room');
const User = require('./models/User');
const bcrypt = require('bcrypt');

function io(server,params){  

    const io = require('socket.io')(server,params);
    
    io.on('connection', (socket,username=false) => {



        socket.on('toggle-language',async(language)=>{
            try{
                const user = await User.findOne({socketId:socket.id});
                console.log('looking for user at ',socket.id);
                if(!user){
                    console.log('io toggle-language: no user');
                    return;
                }
                user.language = language;
                await user.save();
            }
            catch(e){
                console.log('io toggle-language err',e);
            }
        });

        (`
            chat
            question-response
            test
            data
            survey
            observe
            hub
            check-test
            analyze-output-logs



        `).trim()
        .replace(/\s{1,100}/g,' ')
        .split(' ')
        .forEach(file=>{
            socket = require(`./socket/${file}`)(io,socket);
        });    
    })
    return io;
}

module.exports = io;

