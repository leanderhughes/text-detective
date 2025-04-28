const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Task = require('../models/Task');
const Test = require('../models/Test');
const Proficiency = require('../models/Proficiency');
const SavedProficiency = require('../models/SavedProficiency');
const Response = require('../models/Response');
const Question = require('../models/Question');
const { Socket } = require('socket.io');
const {freq,getLemma,alternativeSpelling} = require('../custom_modules/tag');
const checkSpelling = require('../custom_modules/check-spelling');
const {getIsTeacher, checkIfUserNotThere} = require('../custom_modules/user-room');
const cloneData = require('../custom_modules/clone-data');
const autocorrect = require('autocorrect')();
const addRootFolder = require('../custom_modules/add-root-folder');





const {
    getQuestions,
    getResponses
} = require('../custom_modules/question-response');
const { response } = require('express');



async function cloneText(username,task,stage){
    const origTest = await Test.find({username,task});
    if(!origTest.length){
        return [];
    }
    const test = [];
    const firstStage = origTest[0].stage;
    for(let i=0,l=origTest.length;i<l;i++){
        const row = origTest[i];
        if(row.stage!=firstStage){
            continue;
        }
        const testRow = new Test(cloneData(row,'deleteId','deleteDates'));
        testRow.stage = stage;
        await testRow.save
        test.push(testRow);
    }
    return test;
}

function isStringAndHasApos(item){
    return item && typeof item=='string' && item.match(/[\'’]/);
}

function getIndexedTextSlice(text,start,end){
    const slice = [];
    let index = 0;
    text.forEach((item,i)=>{
        const isWord = !item.ignore && typeof item == 'string' && item.match(/\w/);
        isWord && index++;
        // if(index == start-1 && !isWord){
        //     slice.push(item);
        //     return;
        // }
        if(index >= end){
            return;
        }
        if(index < start){
            return;
        }
        slice.push(!isWord ? item : {
            string:item,
            index:index,
            apos: isStringAndHasApos(text[i-1]) || isStringAndHasApos(text[i+1])
        });
    });
    return slice;
}

function blankString(string){
    return string.slice(0,string.length/2)+string.slice(string.length/2).replace(/\w/g,'_');
}

function blankText(text,items){
    return text.map(t=>{
        const item = items.find(i=>i.index==t.index);
        if(!item){
            return t.index ? t.string : t;
        }
        return item.blanked;
    });
}

function getSectionItem(item){
    return {
        index:item.index,
        blanked: blankString(item.string),
        word:item.string,
        lemma:getLemma(item.string)
    };
}

function skipTextItem(item,start,end){
    if(!item){
        return true;
    }
    if(!item.index){
        return true;
    }
    if(item.string.length < 2){
        return true;
    }
    if(item.apos){
        return true;
    }
    if(item.index<start || item.index>end){
        return true;
    }
    if(freq(item.string.toLowerCase()) < 2){
        return true;
    }
    return false;
}

function getSectionItems(indexedText,start,end,maxItemCountPerSection,correctChoice){
    const correctChoiceI = indexedText.reduce((index,item,i)=>{
        if(item.string && item.string.toLowerCase()==correctChoice){
            index = i;
            return index;
        }
        return index;
    },-1);
    maxItemCountPerSection--;
    const beforeItemCount = Math.floor(maxItemCountPerSection/2) + (maxItemCountPerSection%2);
    //const afterItemCount = Math.floor(maxItemCountPerSection/2);
    const items = [];
    let place = 1;
    let gotPastSkip = false;
    for(let i=correctChoiceI;i >= 0; i--){
        const item = indexedText[i];
        if(skipTextItem(item,start,end)){
            continue;
        }
        if(items.length==beforeItemCount+1){
            break;
        }
        gotPastSkip = true;
        place==1 && items.push(getSectionItem(item));
        place*=-1;
    }
    place = 1;
    for(let i=correctChoiceI,l=indexedText.length;i<l;i++){
        const item = indexedText[i];
        if(skipTextItem(item,start,end)){
            continue;
        }
        if(items.length==maxItemCountPerSection+1){
            break;
        }
        place==1 && i!== correctChoiceI && items.push(getSectionItem(item));
        place*=-1;
    }
    place = 1;
    if(items.length < maxItemCountPerSection+1){
        const itemIndexes = items.map(i=>i.index);
        for(let i=correctChoiceI;i >= 0; i--){
            const item = indexedText[i];
            if(skipTextItem(item,start,end)){
                continue;
            }
            if(itemIndexes.includes(item.index)){
                place*=-1;
                continue;
            }
            if(items.length==maxItemCountPerSection+1){
                break;
            }
            place==1 && i!== correctChoiceI && items.push(getSectionItem(item));
            place*=-1;
        }  
    }
    items.sort((a,b)=>a.index - b.index);
    if(items.length < 5){
        //
    }
    return items;

}

function addTranslationItems(items,count){
    return items.map((item,index)=>{
        return {
            w:item.word,
            f:freq(item.lemma),
            index,
            item
        }
    })
    .sort((a,b)=>{return a.f - b.f;})
    .reduce((all,currentItem,index)=>{
        const {item} = currentItem;
        all.push(item);
        if(index < count){
            all.push({
                trans:1,
                afterIndex:item.index,
                index:item.index+.1,
                word:item.word,
                lemma:item.lemma
            });
        }
        return all;
    },[])
    .sort((a,b)=>{return a.index - b.index;});
    

}

async function generateTest(socket){
    const test = [];
    const room = await Room.findOne({'users.socketId':socket.id});
    const username = room.users.find(u=>u.socketId==socket.id).username;
    const task = await Task.findById(room.task);
    const maxItemCountPerSection = task.testCompletionItemsPerSection;
    const maxTranslationItemCountPerSection = task.testTranslationItemsPerSection;
    const text = await Text.findById(task.text);
    const questions = await getQuestions(task);
    const responses = await getResponses(room);
    let previousSectionEnd = -1;
    for(let i=0,l=questions.length;i<l;i++){
        const question = questions[i];
        const correctChoice = question.correctChoice.toLowerCase();
        const response = responses.find(r=>r.question==question.id);
        const questionClone = cloneData(question,'delete id','deleteDates');
        const testRow = new Test(questionClone);
        //testRow.username = username;
        testRow.question = question.id;
        testRow.task = room.task;
        testRow.index = i+1;
        if(response){
            testRow.response = response.id;
        }
        testRow.previousSectionEnd = previousSectionEnd;
        if(questions[i+1]){
            testRow.nextSectionStart = questions[i+1].sectionStart;
        }

        const indexedText = getIndexedTextSlice(text.text,testRow.previousSectionEnd,testRow.nextSectionStart);
        //testRow.text = indexedText;
        //testRow.items = getTestRowItems(testRow,text.text);
        //testRow.text = getTextSlice(text.text,testRow.previousSectionEnd+1,testRow.nextSectionStart);

        const items = addTranslationItems(
            
            getSectionItems(

                indexedText,
                testRow.sectionStart,
                testRow.sectionEnd,
                maxItemCountPerSection,
                correctChoice
            ),
            maxTranslationItemCountPerSection
        );

        testRow.text = blankText(indexedText,items);
        testRow.items = items;
       
        await testRow.save();

        test.push(testRow);
        previousSectionEnd = testRow.nextSectionStart;

    }
    return test;
}

async function getTestBySocket(socket){
    try{
        const room = await Room.findOne({'users.socketId':socket.id});
        if(!room){
            socket.emit('check-hub');
            return;
        }

        const {task} = room;
        //const username = room.users.find(u=>u.socketId==socket.id).username;
        const test = await Test.find({task});
        return test;
    }
    catch(e){
        console.log('getTestBySocked err',e);
    }
}

async function removeTestDuplicates(test){
    const indexes = test.map(t=>t.index);
    const hasDuplicates = indexes.length > [...new Set(indexes)].length;
    if(!hasDuplicates){
        return test;
    }
    test.sort((a,b)=>{return a.id > b.id ? 1 : (a.id==b.id ? 0 : -1);});
    for(let i=test.length-1;i>-1;i--){
        const index = test[i].index;        
        if(test.filter(t=>t.index==index).length>1){
            await Test.deleteOne({_id:test[i].id});
            test.splice(i,1);
        }

    }
    return test;
}


async function getTest(socket){
    try{
        let test = await getTestBySocket(socket)
        if(test && test.length){
            return await removeTestDuplicates(test);
        }
        // const clonedTest  = await cloneText(username,task,stage);
        // if(clonedTest.length){
        //     return clonedTest;
        // }
        test = await generateTest(socket);
        
        return await removeTestDuplicates(test);
    }
    catch(e){
        console.log('getTest err',e);
    }
}

async function generateProficiency(socket,task,username,stage){
    try{
        const profRows = await Proficiency.find({username,task,stage});
        const test = await getTest(socket);
        const testTrueLength = [...new Set(test.map(t=>t.index))].length;
        const profLen = [...new Set(profRows.map(t=>t.index))].length;
        
        if(profLen == testTrueLength){
            //console.log('generateProficiency profAlready ',profAlready.length);
            return profRows;
        }

        
        const totalPointsPossible = test.reduce((sum,t)=>{
            sum+=t.items.length;
            return sum;
        },0);
        for(let i=0,l=test.length;i<l;i++){
            if(profRows.find(p=>p.index==test[i].index)){
                continue;
            }
            const prof = new Proficiency(cloneData(test[i],'delete id','deleteDates'));
            prof.username = username;
            prof.stage = stage;
            prof.answers = test[i].items;
            prof.pointsPossible = prof.answers.length;
            prof.totalPointsPossible = totalPointsPossible;
            prof.dateStarted = Date.now();
            await prof.save();
            profRows.push(prof);
        }
        return profRows;
    }
    catch(e){
        console.log('generateProficiency err',e);
    }
}

async function getOthersProficiency(data){
    try{
        return await Proficiency.find(data);
    }
    catch(e){
        console.log('getOthersProficiency err',e);
    }
    
}

async function getProficiency(socket,stage=false,completeOnly=false){
    try{
        const userNotThere = await checkIfUserNotThere(socket,'getProficiency');
        if(userNotThere){
            console.log('get prof userNotThere', socket ? socket.id : false);
            return [];
        }
        ///find prof by task and username!
        const user = await User.findOne({socketId:socket.id});
        const {task,username} = user;
        let room = await Room.findOne({'users.socketId':socket.id}) || await Room.findOne({task,'users.username':username},{},{$sort:{dateCreated:-1}});
        if(!room && !stage){
            console.log('getProficiency !room && !stage');
            room = {stage:'pretest'};
        }
        stage = stage ? stage : room.stage;
        //const username = room.users.find(u=>u.socketId==socket.id).username;
        const proficiency = completeOnly ? await Proficiency.find({task,username,stage,complete:true}) : await Proficiency.find({task,username,stage});

        if(proficiency.length || completeOnly){
            if(!completeOnly){
                const test = await getTestBySocket(socket);
                const realTestLength =  [...new Set(test.map(t=>t.index))].length;
                if(proficiency.length < realTestLength){
                    console.log('getProficiency proficiency.length < test.length for ',proficiency.length,' VS', test.length,username);
                    // for(let i=0,l=proficiency.length;i<l;i++){
                    //     await Proficiency.deleteOne({_id:proficiency[i].id});
                    // }
                    return await generateProficiency(socket,task,username,stage);
                }
            }
            return proficiency;
        }
        return await generateProficiency(socket,task,username,stage);
    }
    catch(e){
        console.log('getProficiency err',e);
    }
}

async function saveProfRowsTotalPoints(profRows){///
    try{
        const totalPoints = profRows.reduce((sum,p)=>{
            sum+=p.answers.reduce((s,a)=>{
                s+=a.points ? a.points : 0;
                return s;
            },0);
            return sum;
        },0);
        for(let i=0,l=profRows.length;i<l;i++){
            profRows[i].totalPoints = totalPoints;
            //await profRows[i].save();
            await Proficiency.updateOne({_id:profRows[i].id},{totalPoints});
        }
        return profRows;
    }
    catch(e){
        console.log('saveTestTotalPoints err',e);
    }
}

async function addAndSaveAllWrongAnswers(profRows){
    try{
        const allWrongAnswers = profRows.reduce((wrongAnswers,p)=>{
            wrongAnswers.push(...p.answers.filter(a=>a.points<1));
            return wrongAnswers;
        },[]);
        for(let i=0,l=profRows.length;i<l;i++){
            profRows[i].allWrongAnswers = allWrongAnswers;
            //await profRows[i].save();
            await Proficiency.updateOne({_id:profRows[i].id},{allWrongAnswers});
        }
        return profRows;
    }
    catch(e){
        console.log('saveTestTotalPoints err',e);
    }
}

async function saveProfRowsAsComplete(profRows){
    try{
        for(let i=0,l=profRows.length;i<l;i++){
            profRows[i].complete = true;
            await profRows[i].save();
        }
        profRows = await addAndSaveAllWrongAnswers(profRows);
        return profRows;
    }
    catch(e){
        console.log('saveTestTotalPoints err',e);
    }
}

async function saveAndReturnNewAltWord(data){
    try{
        const {
            profRow,
            i,
            altWord,
            altLem
        } = data;
        profRow.answers[i].altWords = profRow.answers[i].altWords ? profRow.answers[i].altWords : [];
        profRow.answers[i].altLems = profRow.answers[i].altLems ? profRow.answers[i].altLems : [];
        profRow.answers[i].altWords.push(altWord);
        profRow.answers[i].altLems.push(altLem);
        profRow.markModified('answers');
        await profRow.save();
        const index = profRow.answers[i].index;
        const test = await Test.findOne({question:profRow.question});
        for(let i=0,l=test.items.length;i<l;i++){
            if(test.items[i].index==index){
                test.items[i].altWords = test.items[i].altWords ? test.items[i].altWords :[];
                test.items[i].altLems =  test.items[i].altLems ?  test.items[i].altLems : [];
                !test.items[i].altWords.includes(altWord) && test.items[i].altWords.push(altWord);
                !test.items[i].altLems.includes(altLem) && test.items[i].altLems.push(altLem);
                break;
            }
        }
        test.markModified('items');
        await test.save();
        return altWord;
    }
    catch(e){
        console.log('saveAndResturnNewAltWord err');
    }
}

function wordsMatch(data){
    const {completeResponse,altSpelling,word,altWords} = data;
    const allCorrectWords = [word,...altWords ? altWords : []];
    let match = false;
    allCorrectWords.forEach(c=>{
        if(match){
            return;
        }
        match = completeResponse.toLowerCase()==c.toLowerCase()||altSpelling==c.toLowerCase()
    });
    return match;
}

function lemsMatch(data){
    const {string,completeLem,altLemma,lemma,altLems} = data;
    if(!string){
        return false;
    }
    if(!completeLem && !altLem){
        return false;
    }
    const check = [];
    completeLem && check.push(completeLem.toLowerCase());
    altLemma && check.push(altLemma.toLowerCase());
    const correct = [lemma,...altLems ? altLems : []].map(c=>c.toLowerCase());
    let match = false;
    correct.forEach(c=>{
        if(match){
            return;
        }
        check.forEach(ch=>{
            if(match){
                return;
            }
            match=c==ch;
        });
    });
    return match;
}

function getProfRow(profRows,itemIndex){
    const row = profRows.find(p=>p.sectionStart<=itemIndex && p.sectionEnd >= itemIndex);
    if(!row){

        console.log('no profRow',profRows.length,itemIndex);
        return false;
    }
    return row;
}

async function checkAndSaveWord(io,socket,data=false,complete=false,timeUp=false){
    try{
        let totalPoints =  -1;
        const profRows = await getProficiency(socket);
        if(!profRows.length){
            console.log('checkAndSaveWord !profRows.length');
            return {username,task,stage,totalPoints};
        }
        const {username,task,stage} = profRows[0];
        if(!data && complete){
            complete && await saveProfRowsAsComplete(profRows);
            
            return {username,task,stage,totalPoints};
        }
        
        const {string,itemIndex,inputIndex} = data;
        const prof = getProfRow(profRows,itemIndex);
        let skipDueToWrongItemCountFromClient = false;
        if(!prof){

            const test = await Test.find({task});
            if(!test.length){
                console.log('checkAndSaveWord !prof !test.length',{task});
                socket.emit('log-message',`checkAndSaveWord !prof !test.length task: ${task}`);
                return;
            }

            const maxIndex = test.reduce((max,t)=>{
                const tm = t.items.reduce((m,i)=>{
                    if(i.index > m){
                        m = i.index;
                    }
                    return m;
                },-1);
                if(tm > max){
                    max = tm;
                }
                return max;
            },-1);

            const minIndex = test.reduce((min,t)=>{
                const tm = t.items.reduce((m,i)=>{
                    if(i.index < m){
                        m = i.index;
                    }
                    return m;
                },Infinity);
                if(tm < min){
                    min = tm;
                }
                return min;
            },Infinity);

            if(itemIndex < minIndex || itemIndex > maxIndex){
                socket.emit('alert-message','Error: Could not save response. Wrong index. Please contact your teacher for help.');
                console.log('checkAndSaveWord skipDueToWrongItemCountFromClient ','min thisIndex max',minIndex,itemIndex,maxIndex);
                socket.emit('log-message',`checkAndSaveWord skipDueToWrongItemCountFromClient','min thisIndex max ${minIndex}, ${itemIndex}, ${maxIndex}`);
                skipDueToWrongItemCountFromClient = true;
                
            }
            else{
                socket.emit('alert-message','Error: Could not save response. Missing test item. Please contact your teacher for help.');
                console.log('checkAndSaveWord !prof');
                socket.emit('log-message',`checkAndSaveWord !prof !test','min thisIndex max ${minIndex}, ${itemIndex}, ${maxIndex}`);

                return {username,task,stage,totalPoints};
            }


        }

        if(skipDueToWrongItemCountFromClient){
            const pr = await saveProfRowsTotalPoints(profRows);
            totalPoints = pr[0] ? pr[0].totalPoints : totalPoints
            complete && await saveProfRowsAsComplete(profRows);
            !complete && socket.emit('feedback-on-word',{
                itemIndex,
                inputIndex,
                spellingCorrect,
                newAltWord
                
            });
            return {username,task,stage,totalPoints};
        }
        let completeResponse = '';
        let spellingCorrect = true;
        let newAltWord = '';
        for(let i=0,l=prof.answers.length;i<l;i++){
            if(prof.answers[i].index==itemIndex){             
                const {blanked,word,lemma,altWords,altLems} = prof.answers[i];
                prof.answers[i].response = string;
                prof.answers[i].inputIndex = inputIndex;
                if(prof.answers[i].trans){
                    prof.answers[i].spellingCorrect = spellingCorrect;
                    break;
                }
                completeResponse = blanked.replace(/_/g,'')+string;
                prof.answers[i].completeResponse = completeResponse;
                const altSpelling = alternativeSpelling(completeResponse);
                const altLemma = altSpelling ? getLemma(altSpelling) : false;
                const completeLem = getLemma(completeResponse);
                const autoCor = autocorrect(completeResponse);
                const autoCorLem = getLemma(autoCor);
                const altAutoCorSpell = alternativeSpelling(autoCorLem);
                const altAutoCorLem = altAutoCorSpell ? getLemma(altAutoCorSpell) : false;
                if(wordsMatch({completeResponse,altSpelling,word,altWords})){
                    prof.answers[i].points = 1;
                }
                else if(lemsMatch({string,completeLem,altLemma,lemma,altLems})){
                    prof.answers[i].points = .5;
                }
                else if(wordsMatch({
                    completeResponse:autoCor,
                    altSpelling: altAutoCorSpell,
                    word,
                    altWords
                })){
                    prof.answers[i].points = .5;
                }
                else if(lemsMatch({
                    string,
                    completeLem:autoCorLem,
                    altLemma:altAutoCorLem,
                    lemma,
                    altLems
                })){
                    prof.answers[i].points = .25;
                }
                else{
                    prof.answers[i].points = 0;
                    spellingCorrect = checkSpelling(completeResponse.toLowerCase());
                }
                if(data && data.hasAnswer && prof.answers[i].points < 1){
                    const isTeacher = await getIsTeacher(socket);
                    if(isTeacher){
                        newAltWord = await saveAndReturnNewAltWord({
                            profRow:prof,
                            i: i,
                            altWord:completeResponse,
                            altLem:completeLem
                        });
                    }
                }
                prof.answers[i].spellingCorrect = spellingCorrect;
                break;
            }
        }
        prof.markModified('answers');
        prof.points = prof.answers.reduce((points,a)=>points+=(a.points||0),0);
        //await prof.save();
        await Proficiency.updateOne({_id:prof.id},{answers:prof.answers,points:prof.points});
        const pr = await saveProfRowsTotalPoints(profRows);
        totalPoints = pr[0] ? pr[0].totalPoints : totalPoints;
        complete && await saveProfRowsAsComplete(profRows);
        !complete && socket.emit('feedback-on-word',{
            itemIndex,
            inputIndex,
            spellingCorrect,
            newAltWord
        });
        //io.in(`observing_${task}`).emit('report-test-progress',{username, stage,inputIndex,totalPoints,complete,timeUp});
        return {username,task,stage,totalPoints};
    }
    catch(e){
        console.log('checkAndSaveWord err',e);
    }
}

async function proficiencyTimeUp(socket){
    try{
        const proficiency = await getProficiency(socket);
        for(let i=0,l=proficiency.length;i<l;i++){
            const prof = proficiency[i];
            prof.timeUp = true;
            prof.complete = true;
            await prof.save();
        }
        //socket.emit('alert-message','Time up!');
        return proficiency;
    }
    catch(e){
        console.log('proficiencyTimeUp err',e);
    }
}


async function testComplete(socket){
    try{
        const userNotThere = await checkIfUserNotThere(socket,'testComplete');
        if(userNotThere){
            return;
        }
        const profRows = await getProficiency(socket);
        const {stage} = profRows[0];
        socket.emit('test-complete',stage);
        socket.emit('check-hub');
        return true;
    }
    catch(e){
        console.log('testComplete err',e);
    }
}

async function saveTrial(socket,name){
    try{
        const profRows = await getProficiency(socket);
        const savedProf = [];
        for(let i=0,l=profRows.length;i<l;i++){
            const prof = new SavedProficiency(cloneData(profRows[i],'delete id','deleteDates'));
            prof.username = name;
            await prof.save();
            savedProf.push(prof);
        }
        return savedProf;
    }
    catch(e){
        console.log('saveTrial err',e);
    }   
}

async function removeAltWord(socket,data){
    try{
        const isTeacher = await getIsTeacher(socket);
        if(!isTeacher){
            return;
        }
        const {altWord,inputIndex,itemIndex} = data;
        const profRows = await getProficiency(socket);
        const prof = getProfRow(profRows,itemIndex);
        let answerIndex = '';
        for(let i=0,l=prof.answers.length;i<l;i++){
            if(prof.answers[i].index==itemIndex){
                answerIndex = i;
                const {altWords,altLems} = prof.answers[i];
                const z = altWords.reduce((z,a,index)=>{
                    if(a==altWord){
                        z = index;
                    }
                    return z;
                },-1);
                altWords.splice(z,1);
                altLems.splice(z,1);
                prof.answers[i].altWords = altWords;
                prof.answers[i].altLems = altLems;
            }
        }
        prof.markModified('answers');
        await prof.save();
        const {question} = prof;
        const test = await Test.findOne({question});
        for(let i=0,l=test.items.length;i<l;i++){
            if(test.items[i].index==itemIndex){
                test.items[i].altWords = prof.answers[answerIndex].altWords;
                test.items[i].altLems = prof.answers[answerIndex].altLems;
            }
        }
        test.markModified('items');
        await test.save();
        socket.emit('removed-alt-word',{
            altWord,
            inputIndex
        });
        
    }
    catch(e){
        console.log('removeAltWord err',e)
    }
}

class TestFunctions{
    constructor(){

    }
    async getTest(socket){
        return await getTest(socket);
    }
    async getProficiency(socket,stage=false,completeOnly=false){
        return await getProficiency(socket,stage,completeOnly);
    }
    async getOthersProficiency(data){
        return await getOthersProficiency(data);
    }
    async testComplete(socket){
        return await testComplete(socket);
    }
    async proficiencyTimeUp(socket){
        return await proficiencyTimeUp(socket);
    }
    async checkAndSaveWord(io,socket,data,complete=false,timeUp=false){
        return await checkAndSaveWord(io,socket,data,complete,timeUp);
    }   
    async saveTrial(socket,name){
        return saveTrial(socket,name);
    }
    cloneData(ob,deleteId,deleteDates){
        return cloneData(ob,deleteId,deleteDates);
    }
    async removeAltWord(socket,data){
        return removeAltWord(socket,data);
    }
}

module.exports = new TestFunctions();