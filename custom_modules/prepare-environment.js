


const Question = require('../models/Question');
const Response = require('../models/Response');
const User = require('../models/User');
const Task = require('../models/Task');
const Test = require('../models/Test');
const Text = require('../models/Text');
const Proficiency = require('../models/Proficiency');
const Room = require('../models/Room');
const Settings = require('../models/Settings');
const Note = require('../models/Note');
const Game = require('../models/Game');
const Admin = require('../models/Admin');

const bcrypt = require('bcrypt');



async function checkForAndSaveExperimentalSettings(testMode){
    try{
        // let settings = await Settings.findOne({});
        // if(settings){
        //     return;
        // }
        await Settings.deleteMany({});
        const testSettings = testMode ? {} : {};
        const settings = new Settings(testSettings);
        await settings.save();
    }
    catch(e){
        console.log('checkForAndSaveExperimentalSettings err',e)
    }
}

async function addMe(){
    const myExperimentalGroup = 0;

    try{
        const settings = await Settings.findOne({});
        const {experimentalAssignment} = settings;
        const myExperimentalCondition = experimentalAssignment[myExperimentalGroup];

        let me = await User.findOne({email:"hughes@mail.saitama-u.ac.jp"});
        if(me){
            if(!me.isTeacher || me.experimentalGroup != myExperimentalGroup || me.experimentalCondition != myExperimentalCondition){
                me.isTeacher=true;
                me.experimentalGroup = myExperimentalGroup;
                me.experimentalCondition= myExperimentalCondition;
                await me.save();
            }

            return;
        }
        console.log('Adding me');
        me = new User({
            email:"hughes@mail.saitama-u.ac.jp",
            username:"hughes@mail.saitama-u.ac.jp",
            personalName:'Leander',
            familyName:'Hughes',
            name:'Leander Hughes',
            sid:'00lh000',
            password: await bcrypt.hash('asdf1234',10),
            isTeacher:true,
            experimentalGroup:myExperimentalGroup,
            experimentalCondition: myExperimentalCondition
        });
        await me.save();
    }
    catch(e){
        console.log('prepare environment: addMe err', e);
    }
}


async function fixData(){
    try{

        const assistants = [
            'note@n.n',
            'chat@c.c',
        ];

        for(let i=2,l=101;i<l;i++){
            assistants.push(...[
                `chat${i}@c.c`,
                `note${i}@n.n`
            ]);
        }
        let assistantCount = 0;
        assistants.push('ges@g.g','aes@a.a');
        const courseAssistants = {'ges@g.g':'ges_d_2021','aes@a.a':'aes_d_2021'};
        for(let i=0,l=assistants.length;i<l;i++){
            const email = assistants[i];
            //await User.deleteOne({email});
            let assistant = await User.findOne({email});
            const course = courseAssistants[email] ? courseAssistants[email] : 'kentaro';
            if(!assistant){
                assistant = new User({
                    personalName:email,
                    familyName:email,
                    name:email,
                    email:email,
                    username:email,
                    sid:email,
                    password: await bcrypt.hash("00000",10),
                    course,

                    experimentalGroup:email.match(/chat/) ? 1 : 0,
                    // attemptLimit:email.match(/[3456]/) ? {} : {
                    //     any:1000
                    // }
                });
                await assistant.save();
                assistantCount++;
            }
        }

        console.log({assistantCount});

        const users = await User.find({});
        for(let i=0,l=users.length;i<l;i++){
            const user = users[i];
            if(!user.username){
                user.username = user.email;
            }
            if(!user.isTeacher){
                if(['hughes@mail.saitama-u.ac.jp'].includes(user.email)){
                    user.isTeacher = true;
                }
                else{
                    user.isTeacher = false;
                }
            }
            if(!user.isAssistant){
                if([
                    'k.imai.275@ms.saitama-u.ac.jp'
                ].includes(user.email)){
                    user.isAssistant = true;
                }
                else{
                    user.isAssistant = false;
                }
            }
            await user.save();
        }
        await User.updateMany({},{socketId:""});

    }
    catch(e){
        console.log('fixData err',e);
    }
}


async function prepareTestEnvironment(){
    console.log('prepareTestEnvironment');

   async function clearDB(){
       try{


       const studentExists =  await User.findOne({username:/.*@ms\..*/});
        if(studentExists){
            console.log('clearDB err: student here?');
            return;
        }
        await Task.deleteMany({});

        await Test.deleteMany({});
        await Question.deleteMany({});
        await Response.deleteMany({});
        await Proficiency.deleteMany({});
     
        await Note.deleteMany({}); 
        await Room.deleteMany({});
       }
       catch(e){
        console.log('clearDB err',e);
       }
   }
    

   async function populateUsers(){
       try{



           //await User.deleteMany({});          //const hashedPassword = await bcrypt.hash("000000",10);
           
           //const notes = await Note.find({});
           // for(let i=WWW18,l=notes.length;i<l;i++){
           //     await notes[i].remove();
           // }

           const search = ['a','b','c'].map(char=>{
               return {
                   email:['','@','.',''].join(char)
               }
           });
           let users = await User.find({$or:search});
           const searchEmails = search.map(item=>{return item.email});
           const userEmails = users.map(item=>{return item.email});
           for(let i in searchEmails){
               const searchEmail = searchEmails[i];
               if(userEmails.includes(searchEmail)){continue;};
               const user = new User({
                   personalName:searchEmail[0],
                   familyName:searchEmail[0],
                   name:searchEmail[0],
                   email:searchEmail,
                   username:searchEmail,
                   sid:searchEmail[0],
                   password: await bcrypt.hash("asdf1234",10)
               });
               if(user.email=='a@a.a' || user.email=='c@c.c'){
                   user.isTeacher = true;                
               }
               user.experimentalGroup = 1;
               await user.save();
           }

           const room = await Room.findOne({});
   
   
       }
       catch(e){
           console.log(e);
       }
   }

    async function clearCheckedFromAnswers(){
        try{
            const erasedCheckCount = await Proficiency.updateMany({'answers.checked':true},{'answers.$.checked':false});
            const profs = await Proficiency.find({});
            const checkedCount = profs.filter(p=>p.answers.filter(a=>a.checked).length);
            console.log({erasedCheckCount,checkedCount});

        }
        catch(e){
            console.log('clearCheckedFromAnswers err',e);
        }
    }
    //Do this ONCE!!!! Then erase!
    //await clearCheckedFromAnswers();
   const timeSpanToFinalizeRooms = 40*1000;
   console.log('settings timeSpanToFinalizeRooms for test mode: '+timeSpanToFinalizeRooms);
   await Settings.updateOne({},{timeSpanToFinalizeRooms});
   

   //await populateUsers();

   //await clearDB();
}

async function addUserAccountIfNotAdded(data){
    
    try{
        let {personalName,familyName,name,email,username,sid,password,experimentalGroup} = data;
        personalName = personalName ? personalName : username.slice(0,1).toUpperCase() + username.slice(1);
        familyName = familyName ? familyName : personalName;
        name = name ? name : personalName + ' ' + familyName;
        email = email ? email : username + '@ms.saitama-u.ac.jp';
        sid = sid ? sid : username;
        password = password ? password : '12345';
        const course = data.course ? data.course : 'kentaro';
        password = await bcrypt.hash(password,10);
        experimentalGroup == data.experimentalGroup === 0 ? 0 : 1;
        const userFound = await User.findOne({username});
        if(userFound){
            console.log('user already added: ',username,'\n\n',userFound);
            return;
        }
        const user = new User({personalName,familyName,name,email,username,sid,password,experimentalGroup});
        await user.save();
        console.log('new user added',username);
    }
    catch(e){

        console.log('addUserAccountIfNotAdded',e);

    }

}

async function prepareEnvironment(testMode=false){
    try{
        await checkForAndSaveExperimentalSettings(testMode);

        if(testMode){

            await prepareTestEnvironment();
        }
        else{
            console.log('prepare-environnment: not in testMode',testMode);

        }

       // await addMe();

        //await fixData();

        //await Task.updateMany({},{archived:true});
        addUserAccountIfNotAdded({username:'demomember',personalName:'Demo',familyName:'Member',course:'demo',password:'000000'});
        addUserAccountIfNotAdded({username:'chiyuki',personalName:'Chiyuki',familyName:'Yanase',course:'demo',password:'chuo90210'});

        console.log('testMode',testMode);

    }
    catch(e){
        console.log('prepare-environment err',e);
    }
}







module.exports = prepareEnvironment;