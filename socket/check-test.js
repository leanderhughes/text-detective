const testMode = require('../custom_modules/test-mode');
const Room = require('../models/Room');
const User = require('../models/User');
const Task = require('../models/Task');
const Text = require('../models/Text');
const Response = require('../models/Response');
const Test = require('../models/Test');
const Proficiency = require('../models/Proficiency');
const CheckTest = require('../models/CheckTest');
const Note = require('../models/Note');
const {
    getTest,
    getProficiency,
    testComplete,
    proficiencyTimeUp,
    checkAndSaveWord,
    saveTrial,
    removeAltWord
} = require('../custom_modules/test');
const {
    getUser,
    getRoom,
    getIsTeacher,
    getUserFull,
    lang,
    checkIfUserNotThere,
    checkIfTeacherNotThere
} = require('../custom_modules/user-room');

const {updateObservationStats} = require('../custom_modules/observe');



const { Socket } = require('socket.io');
const isTestUser = require('../custom_modules/is-test-user');

async function getTestsToCheck(socket,emit='got-tests-to-check'){
    try{
        const tests = await CheckTest.find();

        // for(let i=0,l=tests.length;i<l;i++){
        //     const {task} = tests[i];
        //     const profs = await Proficiency.find({task});
        //     const answers = await getAndUpdateAnswers(socket,profs);
        //     const percentChecked = Math.floor(100*answers.filter(a=>a.checked).length/answers.length);
        //     tests[i].percentChecked = percentChecked;
        // }

        socket.emit(emit,{
            tests: tests.map(t=>{
                const {task,title} = t;
                return {task,title,percentChecked:-1};
            })
        });
    }
    catch(e){
        console.log('getTestsToCheck err',e);
    }
}

async function getAndUpdateAnswers(socket,profs){
    try{
        const responseIndexToPoints = {};
        const answers = profs.reduce((ans,p)=>{
            let {_id,answers} = p;
            answers = answers.filter(a=>a.trans);
            ans.push(...answers.map(a=>{
                const {index,response,points,checked,points2,checked2} = a;
                return {
                    _id,
                    index,
                    response,
                    points: otherRater(socket) ? points2 : points,
                    checked: otherRater(socket) ? checked2 : checked
                };
            }));
            return ans;
        },[]);

        const originalCheckedCount = answers.filter(a=>a.checked).length;
        const originalChecked = answers.filter(a=>a.checked && a.response).map(a=>a.response);
        
        answers.forEach(a=>{
            const {index,response,points,points2,checked} = a;
            if(checked && (!responseIndexToPoints[index] || !responseIndexToPoints[index][response])){
                responseIndexToPoints[index] = responseIndexToPoints[index] ? responseIndexToPoints[index]: {};
                responseIndexToPoints[index][response] = otherRater(socket) ? {points} : {points2};
            }
        });
        const updates = [];
        answers.forEach(a=>{
            const {_id,index,response,checked} = a;
            if(response && !checked && responseIndexToPoints[index] && responseIndexToPoints[index][response]){
                const {points,points2} = responseIndexToPoints[index][response];
                updates.push({_id,index,points,points2,response});
                return true;
            }
            if(!response){
                updates.push({_id,index,points:0,response});
            }
        });
        for(let i=0,l=updates.length;i<l;i++){
            const {_id,index,points,response} = updates[i];
            if(otherRater(socket)){
                await Proficiency.updateOne({_id,'answers.index':index,'answers.response':response},{'answers.$.points2':points,'answers.$.checked2':true});
            }
            else{
                await Proficiency.updateOne({_id,'answers.index':index,'answers.response':response},{'answers.$.points':points,'answers.$.checked':true});
            }
            
        }
        for(let i=0,l=answers.length;i<l;i++){
            const a = answers[i];
            if(updates.find(u=>u.index==a.index && u.response==a.response)){
                answers[i].checked = true;
                answers[i].checked2 = true;
            }
        }
        //socket.emit('log-message',{originalChecked,originalCheckedCount,responseIndexToPoints,updates});
        //console.log({answers});
        return answers;
    }
    catch(e){
        console.log('getAndUpdateAnswers err',e);
    }

}

async function scoreTrans(socket,data,emit='scored-trans'){
    try{
        const {_ids,index,task,points} = data;
        if(otherRater(socket)){
            await Proficiency.updateMany({_id:{$in:_ids},'answers.index':index},{'answers.$.points2':points,'answers.$.checked2':true});
        }
        else{
            await Proficiency.updateMany({_id:{$in:_ids},'answers.index':index},{'answers.$.points':points,'answers.$.checked':true});
        }
        
        socket.emit(emit,{_ids,index,task,points});
    }
    catch(e){
        console.log('scoreTrans err',e);
    }
}

function otherRater(socket){
    return socket.handshake.query.username != 'k.imai.275@ms.saitama-u.ac.jp' && socket.handshake.query.username != 'hughes@mail.saitama-u.ac.jp'; 
}


module.exports = function test(io,socket){

 
        
    // socket.on('get-test-titles',async()=>{
    //     try{
    //         const teacherNotThere = await checkIfTeacherNotThere(socket);
    //         if(teacherNotThere){
    //            return;
    //         }
    //         const profs = await Proficiency.find();
    //         const taskIds = [...new Set(profs.map(p=>p.task))];
    //         const tasks = await Task.find({_id:{$in:taskIds}});
    //         const titles = tasks.map(t=>{
    //             const {_id,title} = t;
    //             return {_id,title};
    //         })
    //         socket.emit('got-test-titles',{titles});
    //     }
    //     catch(e){
    //         console.log('hmm err',e);
    //     }
    // });

    socket.on('get-tests-to-check',async(data)=>{
        await getTestsToCheck(socket);
    });

    socket.on('add-test-to-check',async(data)=>{
        try{
            console.log('add-test-to-check',data);
            const {task} = data;
            const already = await CheckTest.findOne({task});
            if(already){
                socket.emit('alert-message','Already added...');
                return;
            }
            const taskOb = await Task.findOne({_id:task});
            const {title} = taskOb;
            const checkTest = new CheckTest({
                task,
                title
            });
            await checkTest.save();
            await getTestsToCheck(socket,'got-current-tests-to-check');
            socket.emit(`Added ${title}`);
        }
        catch(e){
            console.log('add-test-to-check err',e);
        }
    });

    socket.on('remove-test-to-check',async(data)=>{
        try{
            const {task} = data;
            await CheckTest.deleteOne({task});
            await getTestsToCheck(socket,'got-current-tests-to-check');
        }
        catch(e){
            console.log('add-test-to-check err',e);
        }
    });

    // socket.on('get-test-to-check',async(data)=>{
    //     try{
    //         console.log('get-test-to-check',data);
    //         const {task} = data; 
    //         const test = await Test.find({task});
    //         const profs = await Proficiency.find({task});
    //         const answers = await getAndUpdateAnswers(socket,profs);
    //         const percentChecked = Math.floor(100*answers.filter(a=>a.checked).length / answers.length);
    //         socket.emit('got-test-to-check',{
    //             text:test.reduce((ts,t)=>{
    //                 ts.push(...t.text);
    //                 return ts;
    //             },[]),
    //             items:test.reduce((ts,t)=>{
    //                 ts.push(...t.items);
    //                 return ts;
    //             },[]),
    //             answers,
    //             percentChecked,
    //             task
    //         });
    //     }
    //     catch(e){
    //         console.log('get-test err',e);
    //     }

    // });

    socket.on('score-trans',async(data)=>{
        await scoreTrans(socket,data);
    });

    socket.on('get-users',async(data)=>{
        try{
            const users = await User.find(testMode ? {} : {course:{$in:["ges_d_2021","aes_d_2021"]}});
            socket.emit('got-users',{
                
                users:users.map(u=>{
                    const {username,course} = u;
                    return {
                        username,
                        course
                    };
                })
            });
        }
        catch(e){
            console.log('got-users err',e);
        }
    });

    socket.on('get-test-titles',async()=>{
        try{
            const tasks = await Task.find(testMode ? {} : {archived:false,$or:[{courses:["ges_d_2021"]},{courses:["aes_d_2021"]}]});
            socket.emit('got-test-titles',{
                
                titles:tasks.map(t=>{
                    const {_id,courses,title} = t;
                    return {
                        _id,
                        courses,
                        title
                    };
                })
            });     
        }
        catch(e){
            console.log('get-task-titles',e);
        }
    });
    socket.on('score-trans-no-response',async()=>{
        try{
            if(otherRater(socket)){
                await Proficiency.updateMany({'answers.trans':1,'answers.response':{$exists:false},'answers.checked2':{$exists:false}},{'answers.$.points2':0,'answers.$.checked2':true});
            }
            else{
                await Proficiency.updateMany({'answers.trans':1,'answers.response':{$exists:false},'answers.checked':{$exists:false}},{'answers.$.points':0,'answers.$.checked':true});
            }
            
            socket.emit('scored-trans-no-reponse');
        }
        catch(e){
            console.log('score-trans-no-response err',e);
        }
    });

    socket.on('get-answers-by-username-task',async(data)=>{
        try{
            const {username,task} = data;   
            const answers = [];
            const stages = ['pretest','posttest'];
            for(let y=0,n=stages.length;y<n;y++){
                const stage = stages[y];
                const profs = await Proficiency.find({username,task,stage});
                if(!profs[0]){
                    continue;
                }
                const {totalPoints,totalPointsPossible,transPoints,transPointsPossible,cPoints,cPointsPossible} = profs[0];
                const c = {totalPoints,totalPointsPossible,transPoints,transPointsPossible,cPoints,cPointsPossible};
                const r = {};
                for(let key in c){
                    c[key] = profs[0][key];
                    r[key] = 0;
                }

                const whichPoints = otherRater(socket) ? 'points2' : 'points';
                
                for(let i=0,l=profs.length;i<l;i++){
                    const {_id} = profs[i];
                    const ans = profs[i].answers;


    
                    for(let z=0,c=ans.length;z<c;z++){
                        if(otherRater(socket)){
                            // profs[i].answers[z].checked2 = false;
                            // profs[i].answers[z].points2 = 0;
                            ans[z].checked = ans[z].checked2;
                            ans[z].points = ans[z].points2;
                        }

                        if(!ans[z].trans){
                            r.cPoints +=  ans[z][whichPoints] ? ans[z][whichPoints] : 0;
                            r.totalPoints+= ans[z][whichPoints] ? ans[z][whichPoints] : 0;
                            r.cPointsPossible++;
                            r.totalPointsPossible++;
                            continue;
                        }
                        else{
                            ans[z].points && console.log(ans[z]);
                        }
                        r.transPoints += ans[i] && ans[i][whichPoints] ? ans[i][whichPoints] : 0;
                        r.totalPoints += ans[i] && ans[i][whichPoints] ? ans[i][whichPoints] : 0;
                        r.transPointsPossible+=2;
                        r.totalPointsPossible+=2;

                        ans[z]._id = _id;
                        answers.push(ans[z]);
                    }
                    //otherRater(socket) && await Proficiency.updateOne({_id},{answers:profs[i].answers})
                }
                
                
                const update = {};
                for(let key in c){
                    if(c[key]!==r[key]){
                        update[key]=r[key];
                    }
                }
    
                if(Object.keys(update).length){
                    const _ids = profs.map(p=>p._id);
                    await Proficiency.updateMany({_id:{$in:_ids}},update);
                }
            }          

            // for(let z=0,c=transAns.length;z<c;z++){
            //     for(let key in pointsOb){
            //         transAns[z][key] = poinsOb[key];
            //     }
            //     answers.push(transAns[z]);
            // }
            socket.emit('got-answers-by-username-task',{username,task,answers});
        }
        catch(e){
            console.log('got-answers-by-username-task err',e);
        }
    });

    
    socket.on('get-text-for-task',async(data)=>{
        try{
            console.log('get-text-for-task',data);
            const {task} = data;
            const taskOb = await Task.findOne({_id:task});
            const textId = taskOb.text;
            const textOb = await Text.findOne({_id:textId});
            const {text} = textOb;
            socket.emit('got-text-for-task',{task,text});
        }
        catch(e){
            console.log('get-text-for-task err',e);
        }
    });

    socket.on('score-same-responses',async(data)=>{

        await scoreTrans(socket,data,'scored-same-responses');
    });

    socket.on('get-current-tests-to-check',async()=>{
        await getTestsToCheck(socket,'got-current-tests-to-check');
    });
  
    return socket;
}
