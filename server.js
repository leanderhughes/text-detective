const { AsyncLocalStorage } = require('async_hooks');
const express = require('express');
const app = express();
const server = require('http').Server(app);

const path = require('path');

// function getIo(server,params){  

//     const io = require('socket.io')(server,params);
    
//     io.on('connection', (socket) => {

//         (`
//             choose



//         `).trim()
//         .replace(/\s{1,100}/g,' ')
//         .split(' ')
//         .forEach(file=>{
//             socket = require(`./socket/${file}`)(io,socket);
//         });    
//     })
//     return io;
// }








//app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({extended:false}));

const mongoose = require('mongoose');
DATABASE_URL = `mongodb://localhost:27017/RiskyChoices`;
mongoose.connect(DATABASE_URL,{
    useNewUrlParser:true,
    useUnifiedTopology: true,
    'useCreateIndex': true
});
const db = mongoose.connection;
const Game = require('./models/Game');
const Admin = require('./models/Admin');

const statusLevels = ['rich','middle class','poor'];

function getRandomStatus(){
    return statusLevels[Math.round(Math.random()*(statusLevels.length-1))];
}

function getPreviousStatus(sid,games){
    const previousGame = games.find(game=>game.sid==sid);
    return previousGame ? previousGame.status : false;
}

function getLeastCommonStatus(games){
    if(!games.length){
        return false;
    }
    if(!games.find(game=>game.complete)){
        return false;
    }
    const statusCounts = games.reduce((count,game)=>{
        count[game.status] = count[game.status] ? count[game.status] : 0;
        count[game.status]++;
        return count;
    },statusLevels.reduce((count,stat)=>{
        count[stat]=0;
        return count;
    },{}));
    const countArray = Object.keys(statusCounts).reduce((keyVals,key)=>{
        keyVals.push({status:key,count:statusCounts[key]});
        return keyVals;
    },[]);
    countArray.sort((a,b)=>{return a.count-b.count;});
    return countArray[0].status;
}

async function updateStats(){
    try{
        const admins = await Admin.find({});
        if(!admins.length){
            return;
        }
        admins.forEach(admin=>{
            io.to(admin.socketId).emit('update-available');
        });
    }
    catch(e){
        
    }
}

app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,'/public/index.html'));
});

/* <script src="/jquery.js"></script>
<script src="/elem.js"></script>
<script src="/show-message.js"></script> */



function setGets(){
    `
        jquery.js
        elem.js
        show-message.js
        exportTableToCSV.js
        stats.html      
    `.trim().replace(/[\s]{1,100}/g,' ').split(' ').forEach(file=>{
        app.get(`/${file}`,(req,res)=>{
            res.sendFile(path.join(__dirname,`/public/${file}`));
        });
    });
}

setGets();

//const io = require('./io')(server,{cors:{origin:'*'}});//<--Doesn't work

const io = require('socket.io')(server,{cors:{origin:'*'}});

io.on('connection', (socket) => {
    console.log('connected to socket',socket.id);
    socket.on('?',data=>{
        data.msg = 'socket-workeds';
        socket.emit('log-message',data);
    });
    socket.on('test',()=>{
        socket.emit('log','socket worked');
    });
    socket.on('log-in',async(data)=>{
        console.log('processing log-in');
        try{
            //data.status = 
            const {sid,username} = data;
            const socketId = socket.id;
            const games = await Game.find({});
            console.log('games.length',games.length,'games',games);
            const status = getPreviousStatus(sid,games) || getLeastCommonStatus(games) || getRandomStatus();
            const game = new Game({
                socketId,
                sid,
                username,
                status,
                date:Date.now()
            });
            await game.save();
            socket.emit('logged-in',{username,sid,status});
        }
        catch(e){
            console.log('login error',e);
        }
    });
    socket.on('save-choice',async(data)=>{
        try{
            const game = await Game.updateOne({socketId:socket.id},{$push:{choices:data}});
            socket.emit('saved-choice');
        }
        catch(e){
            console.log('save-choice error',e);
        }
    });
    socket.on('complete-game',async(data)=>{
        try{
            await Game.updateOne({socketId:socket.id},{complete:true});
            await updateStats();
            socket.emit('completed-game');  
        }
        catch(e){
            console.log('completed-game error',e);
        }
    });
    socket.on('get-stats',async(password)=>{
        const unlocked = password == 'asdf1234' ? true : false;
        const admin = new Admin({socketId:socket.id});
        await admin.save();
        const games = await Game.find({});
        socket.emit('got-stats',games.map(game=>{
            const {sid,date,complete,status,choices} = game;
            return {sid,date,complete,status,choices,unlocked};
        }));
    });
    socket.on('disconnect',async()=>{
        console.log(socket.id,'disconnected');
        try{
            await Admin.deleteOne({socketId:socket.id});

        }
        catch(e){

        }
    });
    socket.on('clear-stats',async(pass)=>{
        try{
            if(pass=='asdf1234'){
                await Game.deleteMany({});
                socket.emit('log','cleared');
                socket.emit('update-available');
                return;
            }
            socket.emit('log','wrong password');
        }
        catch(e){

        }
    });
});



const port = 5000;//8080;
server.listen(port,console.log(`Server started on ${port}`));