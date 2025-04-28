//https://www.indiehackers.com/
const addRootFolder = require('./custom_modules/add-root-folder');
const testMode = !addRootFolder();//process.env.NODE_ENV !== 'production';
console.log('testMode',testMode,'addRootFolder',addRootFolder());
//if(testMode){
    require('dotenv').config();
//}

    try {
if (global.gc) {global.gc();}
} catch (e) {
    console.log("`node --expose-gc index.js`");
    process.exit();
}


const express = require('express');
const ejs = require('ejs');
const expressLayouts = require('express-ejs-layouts');
const passport = require('passport');

const methodOverride = require('method-override');
const flash = require('connect-flash');
const session = require('express-session');
const mongoose = require('mongoose');


const { Z_FULL_FLUSH } = require('zlib');

const {generateQuestions} = require('./custom_modules/question-response');



const app = express();
//const server = require('http').Server(app);

const PORT = process.env.PORT || 5000;
//server.listen(PORT,console.log(`Server started on ${PORT}`));

const server = app.listen(PORT,()=>console.log(`Server started on ${PORT}`));



require('./config/passport')(passport);

app.use(expressLayouts);
app.set('view engine','ejs');

mongoose.connect(process.env.DATABASE_URL,{
    useNewUrlParser:true,
    useUnifiedTopology: true,
    'useCreateIndex': true
});
const db = mongoose.connection;
const User = require('./models/User');
const bcrypt = require('bcrypt');

// db.on('error',error=>console.log('db error',error));
// db.once('open',()=>console.log('connected to db'));

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.use(flash());
app.use(session({
     secret:process.env.SESSION_SECRET,
     resave: true,
     saveUninitialized:true
 }));


 app.use(passport.initialize());
 app.use(passport.session());


 //Global vars custom middleware https://tinyurl.com/5dzyjj89 57:00
 app.use((req,res,next)=>{
     res.locals.rootPath =(testMode ? 'http://' : 'https://')+req.get('host')+addRootFolder('');
     res.locals.success_msg = req.flash('success_msg');
     res.locals.error_msg = req.flash('error_msg');
     res.locals.error = req.flash('error');
     req.sesh = function(key,val=null){
        if(val===null){
            return req.session[key];
        }
        req.session[key]=val;
     }
     req.post = function(key){
        return req.body[key];
     }
     req.got = function(key){
        return req.params[key];
     }
     next();
 });

 

app.use(methodOverride('_method'));





// const subscribersRouter = require('./routes/subscribers');
// const userRouter = require('./routes/user');
// app.use('subscribers',subscribersRouter);
app.use('/',require('./routes/index'));

(`
 users
 texts
 chat
 tasks
 data
 surveys
 check-test

`).trim().replace(/\s{1,100}/g,' ').split(' ').forEach(route=>{
  app.use(`/${route}`,require(`./routes/${route}`));
});

app.get('*', function(req, res) {
    res.redirect(addRootFolder('/'));
});



app.locals.loadScripts = function(scriptNames){
  scriptNames = typeof scriptNames != 'string' ? scriptNames : scriptNames.trim().replace(/[^\w-]{1,50}/g,',').split(',').forEach(scriptName=>{ 
      return `<script src="scripts/${scriptName}.js"></script>`;
  });
}



const prepareEnvironment = require('./custom_modules/prepare-environment')(testMode);

const {getLemmasInOrder,getLemmaList} = require('./custom_modules/tag');
const ar = `Imagine a world where everyone lives together`.split(' ').join(', ,').split(',');

//console.log(getLemmasInOrder(`Here are some words that are crazy ass words ___ ___!`));



const contentArrayTest = `Here are some crazy ass words ___ ___!`.split(' ');

const logLinesTest = [['here are some weird words','1'],['never mind this stuff',''],['this is another line with _____ _____ words in it...','1']];

function getGPStats(logLines,contentArray){
    const contentLems = getLemmaList(contentArray);
    
    //logLines = logString.toLowerCase().split('\n').map(l=>l.split('\t'));
   // const {logLines,contentArray} = data;
    linesWithStats = logLines;
    //socket.emit('got-gp-stats',{linesWithStats});
    return logLines.reduce((lines,l)=>{
        
        if(l[1]=='1'){
            const lems = getLemmasInOrder(l[0]);
            const original = lems.filter(m=>contentLems.indexOf(m)==-1 && m.indexOf('_')==-1);
            console.log(original);
            l.push(...[lems.length,original.length,Math.round(original.length*10000/lems.length)/100]);
            lines.push(l);
            return lines;
        }
        l.push('','','','','');
        lines.push(l);
        return lines;
    },[]);
    //console.log('logLines',logLines.length);

}

console.log('getGPStats',getGPStats(logLinesTest,contentArrayTest));


function getPartialScoreFromDataAt(person,test,inputIndex){
    const prof = require(`./static_serverside/${person}_data_${test}`);

    console.log('partial score of ',person,' on ',test,

        prof.reduce((score,p)=>{
            if(p.stage!='pretest'){
                return score;
            }
            console.log('points for sec',p.points);
            score += p.answers.reduce((sum,a)=>{
                if(a.inputIndex>inputIndex){
                    return sum;
                }
                sum+=a.points ? a.points : 0;
                
                return sum;
            },0);
            return score;
        },0)
    );
}

//getPartialScoreFromDataAt('riku','pre',30);




/*

Notes on pretest trial with kids

    Time:
        Riku: 16.5 minutes
        Elina: 10 minutes
        Emiko: 15 minutes

    Progress at 6 min:
        Riku: 
            inputIndex: 13
        Elina:
            inputIndex: 23
    
    totalPoints:
        Riku: 6.5 / 60 (11%)
        Elina: 17.5 / 60 (30%)

    totalPoints expected in 6 min based on final score (totalPoints * 6 min / actualMinutesTaken)
        Riku: 2 / 60 (3%)
        Elina: 10.5 (17.5%)

    score at 6 min:
        Riku: 1 / 60 (2%)
        Elina: 6 / 60 (10%)

    score at 6 min per completed:
        Riku: 1 / 13 (7%)
        Elina: 6 / 23 (26%)
    
    efficiency (totalPoints/totalPointsPossible/totalTime):
        Riku:  0.6%
        Elina: 3%
    
    App Notes:

        Time tracking of data needs to be added
        Arrow keys need to function within input
        Students need to know they can skip words they do not know
        Inputs should be numbered

    Kentaro's work:

    https://docs.google.com/document/d/19s8CPGXrebGAeBlOpvSCYHTzWUlSsgpIdq8N2MRXDEg/edit


*/

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


const io = require('./io')(server,{cors:{origin:'*'}});

//const io = require('socket.io')(server,{cors:{origin:'*'}});

io.use(function(socket, next){
    var username = socket.handshake.query.username;
    if (username){
        console.log('socket.handshake.query.username',username);
        next();          
    } else {
        next(new Error('Authentication error'));                  
    }
    return;       
});

io.on('connection', async(socket) => {
    try{
        const username = socket.handshake.query.username;
        const token = socket.handshake.query.token;
        if(!username){
            socket.emit('go-home','no !username');
            return;
        }
        const user = await User.findOne({username,token});
        if(!user){
            socket.emit('go-home','no token match');
            return;
        }
        user.socketId = socket.id;
        user.token = await bcrypt.hash(Date.now()+user.id,10);
        user.loggingIn = false;
        await user.save();
        socket.emit('connected-user',`${username} connected to socket ${user.socketId}`);
    }
    catch(e){
        console.log('io connect-user err',e)
    }




});

const autocorrect = require('autocorrect')();

// function c(s){
//     console.log(s,autocorrect(s));
// }

// ['acknolege','goel','substition'].forEach(w=>c(w));



const {getRandomWords,tagSentence} = require('./custom_modules/tag');



/*



//4 * 3 keyword notes (no no note)

//12 translations

//fuzzy spell check

Delete previous tries options

rooming!

load Kentarou's texts


//
Notes about tutorial

It is important to explain that notes do not have to be paraphrases. The trick is to take a section note that will help you find the sentence later and a word note that considers the surrounding context (so that you can notice the word in the seciton when you look back at it)
YOU can ALWAYS look back at the text (and your notes!) when answering questions


-->
'self-control' --> self [自] is fine




//Next steps

///Short practice version
Find short interesting text to use


//FIX

//pre-test failed to show....!
//Scrolling stops after showing translation items...!
//Rooming!!!!!!


//comma quotes in tests ,"

//Spellcheck red only temporary... Make permanent



ADD
Recommended time
Pronunciation

section note:
word note:
chat item: 


CHANGE

note taking --> Qs 6 -> 3!

//CHECK
//Time if first player finished pret


////////AFter GES/AES orientation day

1. THREE ===> TWO!

2. room -- finding some go right away, some have count down WTF (for task only at least)!


3. TIIIIIIIIIIIIMMMMMMMMMMMMMMME!!!!!!!!!!!!! increase????

4. ERRRRRORRRRRSSS => __________ __ ____ [TOO irritating. Blank it instead.]

5. crazy scrollIntoView in observe (toggle it?)

6. user chooses not shown (?) in observe

7. Need STATS page!




/////

FIRST DAY OF EXPERIMENT with aes_d_2021

AES_D_2021----------

Pre-pre-test VS Script Study order: See "About your homework" surve to eliminate scores from wrong order tests


NOTE PROBLEMS

Shota Fujisaki had major problem with the pretest submission and having been taken back to the task page (log in issue?). Disregard his results? Check...


Miki Matsui did not realize she was doing the Note version. She asked "Are you there?"

a.takeuchi.220@ms.saitama-u.ac.jp (Note) also did not get to the questions

h.akimoto.935@ms.saitama-u.ac.jp and y.ichikawa.278@ms.saitama-u.ac.jp GOT to the questions!!!! Have them teach others next time!

GES_D_2021----------
Many note-takers timed out before they finished taking their notes.
NO ONE GOT to the question in the NOTE vesion...

Problem and we went overtime... some students couldn't finish as evidenced by 0 0 0 s at end of post-test

dono.m.937@ms.saitama-u.ac.jp didn't know what to do in NOTE

"tsujimura.c.706@ms.saitama-u.ac.jp" got 59 and then 60/60!!! Cheating??


 
omori.y.820@ms.saitama-u.ac.jp had error on post-test Then started task again.

CHAT Problems

In chat with shinohara.m.785@ms.saitama-u.ac.jp, witness left, others were stuck!!!
"nakamura.t.572@ms.saitama-u.ac.jp" in two rooms at same time???


NOTE TAKING NEEDS to be EXPLAINED AGAIN!!!!!

Put groups in zoom groups and have them share and ask questions (?)

"kondo.m.682@ms.saitama-u.ac.jp" --> "sendが出るときと出ないときの違いがよくわからない。チャットバージョンとノートバージョンの時にそれぞれ何をしたらいいのかいまいちわからなかったのでもう一度詳しく説明してほしい。"
	j.kozawa.784@ms.saitama-u.ac.jp --> "自分が個人なのかグループなのかわからなかった。アンサーポイントがもらえるであろう問題がどこにあるのかわからなかった。"
//"かなり難しかった。探偵の問題は何が正解なのかいまいちわからない。"

"sendが出るときと出ないときの違いがよくわからない。チャットバージョンとノートバージョンの時にそれぞれ何をしたらいいのかいまいちわからなかったのでもう一度詳しく説明してほしい。"
"自分が個人なのかグループなのかわからなかった。アンサーポイントがもらえるであろう問題がどこにあるのかわからなかった。"
"かなり難しかった。探偵の問題は何が正解なのかいまいちわからない。"

Students need to click "Save and Finish NOTE" Take notes FAST! ___ is OK! Get to questions!

STUDENTS need to be REMINDED to go back to the task if something happens that takes them away from the task.

Zoom Room helps....

Program:

    "send" button sometimes appears in note version!!??  //ノートを保存する　　　ノートを保存して次に進む




    SHOW NOTE or CHAT version!!

    observe.js

        Put 'Note' or 'Chat' above each window.
        Add immediate feedback and task, prof score detection to "observe" page

        Add room switch capability for chat students who end up alone!

    Douple check rooming system - one student had two rooms. 

    Three still being assigned to more than one room.

    Look up keyword to see if they got it right

    Multiple-attempt: SAVED-PROFICIENCY problem!!!!

        "saito.m.384@ms.saitama-u.ac.jp" has to pretests (in SavedProficiency) instead of pre and post... shit.

    task redirect...

    Translate buttons?

    //NOTE: Show original choices!!!!!!!!!!!!!!!!!!!!!<---Thank you Kentaro!


    Experiment: Day 2 (AES)

    Total failure.... had them do Sudden Wealth (really short) after server crashed when they attempted L2 (L2 next time....)

    Students still confused about versions versus roles... (chat / note) (detective / witness)

    Made role change bold


    page doesn't move on from pretest after timeout for some users..;


room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
checkIfUserNotThere redirect msg saveNote
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
socket.handshake.query.username ueda.i.808@ms.saitama-u.ac.jp
socket.handshake.query.username ueda.i.808@ms.saitama-u.ac.jp
socket.handshake.query.username ueda.i.808@ms.saitama-u.ac.jp
disconnecting unknown user
disconnecting unknown user
socket.handshake.query.username ueda.i.808@ms.saitama-u.ac.jp
socket.handshake.query.username ueda.i.808@ms.saitama-u.ac.jp
disconnecting unknown user
socket.handshake.query.username ueda.i.808@ms.saitama-u.ac.jp
checkIfUserNotThere redirect msg saveNote
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
checkIfUserNotThere redirect msg saveNote
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
checkIfUserNotThere redirect msg saveNote
checkIfUserNotThere redirect msg saveNote
disconnecting unknown user
checkIfUserNotThere redirect msg saveNote
disconnecting unknown user
disconnecting unknown user
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
disconnecting unknown user
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
checkIfUserNotThere redirect msg saveNote
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oda.s.174@ms.saitama-u.ac.jp, amano.s.501@ms.saitama-u.ac.jp, emori.k.949@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  sato.y.595@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
disconnecting unknown user
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
disconnecting unknown user
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  ogawa.y.258@ms.saitama-u.ac.jp, shimoji.m.234@ms.saitama-u.ac.jp, kato.a.913@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
disconnecting  emori.k.949@ms.saitama-u.ac.jp
failed to get roundEnds for  enomoto.h.288@ms.saitama-u.ac.jp, ogiya.t.359@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  enomoto.h.288@ms.saitama-u.ac.jp, ogiya.t.359@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  sato.y.595@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  enomoto.h.288@ms.saitama-u.ac.jp, ogiya.t.359@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
socket.handshake.query.username emori.k.949@ms.saitama-u.ac.jp
failed to get roundEnds for  sato.y.595@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  oshima.k.235@ms.saitama-u.ac.jp, ishizaki.a.265@ms.saitama-u.ac.jp, komatsu.r.804@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
disconnecting  emori.k.949@ms.saitama-u.ac.jp
socket.handshake.query.username emori.k.949@ms.saitama-u.ac.jp
failed to get roundEnds for  sato.y.595@ms.saitama-u.ac.jp
currentRound 1
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
disconnecting  emori.k.949@ms.saitama-u.ac.jp
socket.handshake.query.username emori.k.949@ms.saitama-u.ac.jp
failed to get roundEnds for  iida.y.120@ms.saitama-u.ac.jp, onodera.k.281@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  iida.y.120@ms.saitama-u.ac.jp, onodera.k.281@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
failed to get roundEnds for  iida.y.120@ms.saitama-u.ac.jp, onodera.k.281@ms.saitama-u.ac.jp
currentRound 2
room.sequence [ 'task' ]
room.users.find(r=>r.currentStage!='task') undefined
disconnecting  emori.k.949@ms.saitama-u.ac.jp
submit-task-feedback {
  data: {
    room: '62b910ce89dc35770739733b',
    feedback: 'If witness send',
    silent: true
  }
}

///Submit task feedback stopped server





*/


