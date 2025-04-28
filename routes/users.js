const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');

const User = require('../models/User');
const Settings = require('../models/Settings');

const addRootFolder=  require('../custom_modules/add-root-folder');
const getExperimentalCondition = require('../custom_modules/get-experimental-condition');



const courses = {
    //ges_d_2021:[ "(teacher)","20rm001", "20rr029", "20ta014", "21ed404", "21pi010", "21pi011", "21pi017", "21pj009", "21pj105", "21pj405", "21pj502", "21pn001", "21pn004", "21pn012", "21pn019", "21pn020", "21pp002", "21pp007", "21pp031", "21pp044", "21pp053", "21pp059", "21pp100", "21pp107", "21pp127", "21pp132", "21pp134", "21pp135", "21pp144", "21pp152", "21pp203", "21pp249", "21pp307", "21ps017" ], 
    //aes_d_2021: [ "20ll007", "20ll008", "20ll009", "20ll011", "20ll015", "20ll022", "20ll039", "20ll049", "20ll058", "20ll067", "20ll081", "20ll085", "20ll086", "20ll090", "20ll092", "20ll097", "20ll115", "20ll120", "20ll127", "20ll138", "20ll140", "20ll160", "20ll164" ]
    ges_2022:["22pi006","22pi010","22pi011","22pj103","22pj104","22pj105","22pj106","22pj109","22pj201","22pj207","22pj308","22pj405","22pj501","22pj603","22pn019","22pp008","22pp015","22pp018","22pp036","22pp043","22pp047","22pp052","22pp053","22pp061","22pp064","22pp083","22pp111","22pp113","22pp116","22pp123","22pp131","22pp145","22pp148","22pp207","22ps004","22ps007","22pj107"],
    aes_2021:["21ll001","21ll002","21ll003","21ll004","21ll008","21ll010","21ll014","21ll016","21ll017","21ll018","21ll019","21ll021","21ll022","21ll026","21ll027","21ll033","21ll034","21ll035","21ll036","21ll037","21ll038","21ll041","21ll046","21ll047","21ll050","21ll053","21ll058","21ll062","21ll069","21ll073","21ll076","21ll077","21ll078","21ll079"]

}; 

function getCourse(sid){
    for(key in courses){
        if(courses[key].includes(sid.toLowerCase())){
            return key;
        }
    }
    return '';
}



router.get('/login',(req,res)=>{
    res.render('login');
});


async function login(data){
    const {req,res,next,email,password} = data;
    req.body.email = email ? email : req.body.email;
    req.body.password = password ? password : req.body.password;

    try{
        if(req.body.email && req.body.email.indexOf('@')==-1){
            if(req.body.email=='hughes'){
                req.body.email = 'hughes@mail.saitama-u.ac.jp';
            }
            else if(['chat','note'].includes(req.body.email.slice(0,4))){
                const string = req.body.email;
                req.body.loggingIn = true;

                req.body.email = `${string}@${string[0]}.${string[0]}`;
                if(string.match(/x/)){
                    const reg = new RegExp(req.body.email.slice(0,4)+'\\d\\d@'+string[0]+'.'+string[0])
                    const user = await User.findOne({username:reg,socketId:"",loggingIn:{$not:{$eq:true}}});

                    if(user){
                        req.body.email = user.email;
                    }
                }
                req.body.password = '00000';
            }
            else if(req.body.email.indexOf('@')==-1){
                req.body.email = req.body.email+'@ms.saitama-u.ac.jp';
            }
        }
        if(req.body.email=='x@x.x'){

            const user = await User.findOne({socketId:''});
            if(!user){
                console.log(`...Couldn't find user.`);
                return;
            }
            req.body.email = user.email;
        }
        passport.authenticate('local',{
            successRedirect:addRootFolder('/dashboard'),
            failureRedirect:addRootFolder('/users/login'),
            failureFlash:true
        })(req,res,next);
    }
    catch(e){
        console.log(e);
    }
}

router.post('/login',async (req,res,next)=>{
    await login({req,res,next});
});

router.get('/register',(req,res)=>{
    res.render('register')
});

async function assignExperimentalGroup(course){//consider random stratified sample
    try{
        const settings = await Settings.findOne({});
        const {experimentalAssignment} = settings;
        const users = await User.find({course:course});
        if(!users.length){
            return Math.round(Math.random()*(experimentalAssignment.length-1));
        }
        let tallies = [];
        experimentalAssignment.forEach((a,index)=>{
            tallies[index] = 0;
        });
        users.forEach(u=>{
            tallies[u.experimentalGroup]++;
        });
        tallies = tallies.map((count,index)=>{
            return {
                index,
                count
            };
        });
        tallies.sort(function(a,b){return Math.random()-.5;});
        tallies.sort(function(a,b){return a.count - b.count;});
        const differentCounts = [...new Set(tallies.map(t=>t.count))];
        const hasChat = experimentalAssignment.includes('chat');
        if(hasChat && differentCounts.length===1){
            const chatGroupEven = differentCounts[0]%2==0;
            const chatIndex = experimentalAssignment.indexOf('chat');
            for(let i=0,l=experimentalAssignment.length;i<l;i++){
                if(chatGroupEven && i!=chatIndex){
                    return i;
                }
                if(!chatGroupEven && i==chatIndex){
                    return i;
                }
            }
        }
        return tallies[0].index;
    }
    catch(e){
        console.log('assignExperimentalGroup err', e);
    }
 
}

async function register(data){//{name,email,password,password2,postOnly=false}
    const {req,res,familyName,personalName,sid,email,changePassword,password,password2,postOnly} = data;
    const name = personalName + ' ' + familyName;
    const params = {};
    const errors = [];
    const requiredFields = ['name','email','password','password2'];
    !postOnly && requiredFields.forEach(field=>{
        if(errors.length){
            return;
        }
        if(!req.body[field]){
            errors.push({msg:'Please fill in all fields.'});
            return;
        }
        params[field]=req.body[field];
    });
    password!==password2 && errors.push({msg:"Passwords do not match."});
    password.length < 6 && errors.push({msg:"Passwords should be at least 6 characters."});
    params.errors = errors.length ? errors : false;    
    if(!postOnly && params.errors){
        res.render('register',params)
        return;
    }
    try{
        const user = await User.findOne({email:email});
        if(user){
            const currentCourse = getCourse(sid);
            if(user.course!=currentCourse){
                if(!user.formerCourses.includes(user.course)){
                    await User.updateOne({email:email},{$push:{formerCourses:user.course}});
                }
                const experimentalGroup = await assignExperimentalGroup(user.course);
                await User.updateOne({email:email},{
                    course:currentCourse,
                    experimentalGroup
                });
            }
            if(changePassword=='changePassword'){
                user.password = bcrypt.hash(password,10);
                await user.save();
                return true;
            }
            params.errors = [{msg:'Email is already registered.'}];
            !postOnly && res.render('register',params);

            return;
        }
        const course = getCourse(sid);
        const username = email;
        const newUser = new User({
            familyName,
            personalName,
            name,
            email,
            username,
            password:await bcrypt.hash(password,10),
            sid,
            course,
            experimentalGroup: await assignExperimentalGroup(course),
            isTeacher:email=='hughes@mail.saitama-u.ac.jp'
        });
        await newUser.save();
        !postOnly && req.flash('success_msg',"You are now registered and can log in.");
        !postOnly && res.redirect(addRootFolder('/users/login'));
        if(postOnly){
            return true;
        }
    }
    catch(e){
        console.log('register err',e);
        res.render('register',params);
        return;
    }
}

router.post('/register',async(req,res)=>{

    const {pesonalName,familyName,sid,email,password,password2} = req.body;
    try{
        await register({req,res,pesonalName,familyName,sid,email,password,password2});
    }
    catch{

    }
 
});

router.post('/systemLogin',async(req,res)=>{
    try{
        const {username,personalName,familyName,sid,password,systemPass,changePassword} = req.body;
        if(systemPass!='orangeAisleAbrasive1951'){
            res.send('{"Error":"system login failed... incorrect password"}');
            return;
        }
        
        const password2 = password;
        let email = '';
        let name = '';

        if(username && username.indexOf('@')==-1){
            if(username=='hughes'){
                email = 'hughes@mail.saitama-u.ac.jp';
                name = username;
            }
            else{
                email = username+'@ms.saitama-u.ac.jp';
                name = username;
            }
        }
        else{
            email = username;
            name = username.split('@')[0];
        }

        const registered = await register({req,res,personalName,familyName,sid,email,changePassword,password,password2,postOnly:true});
        if(registered){
            res.send('{"success":"systemLoggedIn"}');
        }
        else{
            res.send('{"Error":"system login failed..."}');
        }
        
    }
    catch(e){
        console.log('systemLogin err',e);
    }
});

router.get('/logout',(req,res)=>{
    req.logout();
    req.flash('success_msg','You are logged out');
    res.redirect(addRootFolder('/users/login'));
});

module.exports = router;