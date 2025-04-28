const Text = require('../models/Text');
const Task = require('../models/Task');
const Room = require('../models/Room');
const Question = require('../models/Question');
const Response = require('../models/Response');
const {sliceIntoSets,drawItemsFromSets,drawFromSetsIntoHands,flattenArrayOfSets}=require('./deal');
const {maxTries} = require('../config_for_game/question-response');//move to settings model
const {filterFormat,getTagOb,getLemmaList,getOffListLemmas,getLemmasInOrder} = require('./tag');
const getSynonyms = require('./get-synonyms');
const Note = require('../models/Note');
const questionResponse = require('../config_for_game/question-response');
const Settings = require('../models/Settings');
const cloneData = require('./clone-data');
const isTestUser = require('./is-test-user');
const {checkIfUserNotThere} = require('./user-room');



function addWordIndexes(delta){
    let index = 0;
    return delta.map(item=>{
        if(item.match(/\w/)){
            index++;
            return {
                string: item,
                index: index
            }
        }
        return {
            string:item,
            index:0
        }            
    });
}

function getLemmaSlice(indexed,start,end){
    return getLemmasInOrder(indexed.reduce((slice,item)=>{
        if(item.index > end || item.index < start){
            return slice;
        }
        slice.push(item.string);
        return slice;
    },[]));
}

function getSentences(delta){
    return delta.reduce((items,item)=>{
        items[items.length-1].push(item);
        (item.string[0]=='\n' || item.string.match(/[!?\.]\s/)) && items.push([]);
        return items;
    },[[]]);
}

function countWordsInSentence(sentence){
    return sentence.reduce((sum,item)=>{
        sum+= item.index ? 1 : 0;
        return sum;
    },0);
}

function getSections(delta,minWordCount){
    let sentenceCount = 0;
    const sections = delta.reduce((items,item)=>{
        item.find(i=>i.string && i.string.match(/[a-zA-Z]/)) && sentenceCount++;
        if(sentenceCount<2){
            return items;
        }
        if(items.length && countWordsInSentence(items[items.length-1])<minWordCount){
            items[items.length-1] = [...items[items.length-1],...item];
            return items;
        }
        items.push(item);
        return items;
    },[]);
    if(countWordsInSentence(sections[sections.length-1])<minWordCount){
        const lastSection = sections.pop();
        sections[sections.length-1] = [...sections[sections.length-1],...lastSection];
    }
    return sections;
}

function sectionIndexesPerWord(delta){
    return delta.reduce((ob,section,i)=>{
        section.chunks.forEach((item)=>{
            if(item.index){
                ob[item.string] = ob[item.string] ? ob[item.string] : [];
                ob[item.string].indexOf(i)==-1 && ob[item.string].push(i);
            }
        })
        return ob;
    },{});
}

function addSectionIndexes(delta){
    return delta.map((section,index)=>{
        section.sectionIndex = index+1;
        return section;
    });
}

function addSectionVersions(delta){
    return delta.map((section,index)=>{

        return {
            chunks:section,
            string:section.reduce((string,item)=>{
                string+=item.string;
                return string;
            },''),
            sectionStart: section.find(item=>{return item.index}).index,
            sectionEnd:section.reduce((index,item)=>{
                index = item.index ? item.index : index;
                return index;
            },0)
        }
    });
}

function markKeywords(delta,tagOb,keywords=[]){
    keywords = keywords.map(k=>k.toLowerCase());
    function importance(string){
        if(keywords.length && string && keywords.includes(string.toLowerCase())){
            return Infinity;
        }
        return tagOb[string] ? tagOb[string].importance : 0;
    }
    const indexes = sectionIndexesPerWord(delta);
    return delta.map((section,index)=>{
        let count = Infinity;
        section.keyword = section.chunks.reduce((word,item)=>{
            if(!item || !item.index){
                return word;
            }
            //indexes[item.string].length <= count &&
            word = importance(item.string) > importance(word) ? item.string : word;
            count = indexes[word] ? indexes[word].length : Infinity;
            return word;
        },'');
        if(!section.keyword){
            section.error = 'No original keyword found for section "'+section.string+'" Edit section to ensure original keyword.'; 
        }
        else{
            section.importance = importance(section.keyword);
            if(keywords.includes(section.keyword.toLowerCase())){
                section.hasGrandKeyword = 1;
            }
        }
        section.keywordSectionIndexes = indexes[section.keyword];
        return section;
    });

}

function addKeywordIndexes(delta){
    return delta.map(section=>{
        section.keywordIndexes = delta.reduce((indexes,sec)=>{
            sec.chunks.forEach(chunk=>{
                chunk.string==section.keyword && indexes.push(chunk.index);
            });
            return indexes;
        },[]);
        return section;
    });
}

function getDistractors(set){
    return set.reduce((distractors,section)=>{
        const {
            keyword,
            keywordIndexes,
            keywordSectionIndexes
        } = section;
        distractors.push({
            keyword,
            keywordIndexes,
            keywordSectionIndexes
        });
        return distractors;
    },[]);
}

async function getAllSynonyms(words){
    const allSynonyms = {};
    for(let i=0,l=words.length;i<l;i++){
        const synonyms = await getSynonyms(words[i]);
        if(!synonyms.length){
            continue;
        }
        allSynonyms[words[i]]=synonyms.filter(word=>!words.includes(word));
    }
    return allSynonyms;   

}



function addChoices(questionSets,distractorCount){
    const allDistractors = getDistractors(flattenArrayOfSets(questionSets));
    return questionSets.map(set=>{
        const distractors = getDistractors(set);
        return set.map(section=>{
            const {
                keyword,
                keywordIndexes,
                keywordSectionIndexes
            } = section;
            const correct = {
                keyword,
                keywordIndexes,
                keywordSectionIndexes
            };
            section.choices = [correct,...[...distractors,...allDistractors].reduce((distractors,distractor)=>{
                if(distractors.length==distractorCount){
                    return distractors;
                }
                if(distractor.keyword==correct.keyword){
                    return distractors
                }
                
                //already.push(distractor);
                distractors.push(distractor);
                return distractors;
            },[])];
            return section;
        });
    });    
}

function trimQuestionSets(questionSets,questionCount){
    console.log('questionSets-->',questionSets);
    function defaultSortFunction(a,b){
        return b.importance - a.importance; //importance(b.string) - importance(a.string);
        //return b.string.length - a.string.length;
    }
    function hasGrandKeyword(sec){
        return sec.hasGrandKeyword ? 1 : 0;
    }   
    function byKeywordSortFunction(a,b){
        return b.importance - a.importance; // return importance(b.string) - importance(a.string);
        //return hasGrandKeyword(b) - hasGrandKeyword(a);
    }
    const hasGrandKeywords = questionSets.reduce((has,set)=>{
        has = has ? has : set.reduce((inSec,sec)=>{
            inSec = inSec ? inSec : sec.hasGrandKeyword;
            return inSec;
        },false);
        return has;
    },false);
    return questionSets.map(questionSet=>{
        return questionSet.map((s,i)=>{
            s.i = i;
            return s;
        })
        .sort(hasGrandKeywords ? byKeywordSortFunction :  defaultSortFunction)
        .slice(0,questionCount)
        .sort((a,b)=>{return a.i - b.i})
        .map(question=>{
            delete question.i;
            return question;
        });
    });
}

function addSetIndexes(sets){
    return sets.map((set,index)=>{
        const setStart = set[0].sectionStart;
        const setEnd = set[set.length-1].sectionEnd;
        return set.map(s=>{
            s.setStart = setStart;
            s.setEnd = setEnd;
            s.setIndex = index+1;
            return s;
        });
    });
}


async function addIllegalWords(sets,tagOb){
    try{
        const settings = await Settings.findOne({});
        const {illegalWordExceptions} = settings;
        sets.map(set=>{
            const illegalWords = [];
            set.forEach(q=>{
                //const sectionString = set.map(q=>q.string).join(' ');
                const qTagOb = getTagOb(q.string);

                const keyLemma = tagOb[q.keyword].lemma ? tagOb[q.keyword].lemma : tagOb[q.keyword].normal;
                !illegalWords.includes(keyLemma) && illegalWords.push(keyLemma);
                for(let key in qTagOb){
                    if(!key.match(/\w/)){
                        continue;
                    }
                    if(!tagOb[key].lemma){
                        tagOb[key].lemma = tagOb[key].normal
                    }
                    if(
                        (!illegalWordExceptions.includes(tagOb[key].lemma) && key[0].match(/[A-Z]/) && !key.slice(1).match(/[A-Z]/)) || 
                        tagOb[key].lemma.match(/\d/) || 
                        qTagOb[key].lemmaCount==tagOb[key].lemmaCount
                    ){
                        if(!tagOb[key].lemma.match(/\d/) && !key[0].match(/[A-Z]/) && tagOb[key].rawImportance < 10){
                            continue;
                        }            
                        !illegalWords.includes(tagOb[key].lemma) && illegalWords.push(tagOb[key].lemma);
                    }
                } 
            });

            return set.map(q=>{
                q.illegalWords = illegalWords;
                return q;
            });
        });
    }
    catch(e){
        console.log('addIllegalWords err',e);
    }
}

function addSetLemmas(sets){
    return sets.map(set=>{
        const setLemmas = [];
        set.forEach(q=>{
            setLemmas.push(...getLemmasInOrder(q.string));
        });
        return set.map(q=>{
            q.setLemmas = setLemmas;
            return q;
        });
    });
}



function getExceptionWords(ar){
    return getOffListLemmas(getLemmaList(ar));
}

async function getQuestionsError(task){
    const minSectionLengthInWords = 20;
    const distractorCount = 3;
    const questionsPerSet = distractorCount+1;
    const sectionsRequired = questionsPerSet * task.questionCount;
    try{
        const text = await Text.findById(task.text);
        const keywords = text.keywords;
        const filtered = filterFormat(text.text);
        const indexed = addWordIndexes(filtered);
        const sentences = getSentences(indexed);
        const sections = getSections(sentences,minSectionLengthInWords);
        if(sections.length < sectionsRequired){
            const wordsNeeded = (sectionsRequired - sections.length)*20;
            return {
                error:{
                    message:`This text is not long enough for this task. About ${wordsNeeded} more words needed.`,
                    herp:'derp',
                    origin:'getQuestionsError'
                }
            };
        }
        const sectionsWithVersions = addSectionVersions(sections);
        const sectionsWithIndexes = addSectionIndexes(sectionsWithVersions);
        const tagOb = getTagOb(filtered);
        const keywordsMarked = markKeywords(sectionsWithIndexes,tagOb,keywords);
        const keywordIndexesIncluded = addKeywordIndexes(keywordsMarked);
        const questionSets = sliceIntoSets(keywordIndexesIncluded,task.questionCount);//keywords.length ? sliceIntoSetsByKeywords(keywordIndexesIncluded,task.questionCount) : 
        const trimmedQuestionSets = trimQuestionSets(questionSets,questionsPerSet);
        const errorOb = flattenArrayOfSets(trimmedQuestionSets).find(sec=>sec.error);
        if(errorOb){
            return errorOb.error;
        }
        return false;
    }
    catch{

    }
}

async function generateQuestions(task){
    if(typeof task == 'string'){
        task = await Task.findById(task);
    }
    const minSectionLengthInWords = 20;
    const distractorCount = 3;
    const questionsPerSet = distractorCount+1;
    const sectionsRequired = questionsPerSet * task.questionCount;
    try{
        const text = await Text.findById(task.text);
        const keywords = text.keywords;
        const filtered = filterFormat(text.text);       
        const indexed = addWordIndexes(filtered);
        const sentences = getSentences(indexed);
        const sections = getSections(sentences,minSectionLengthInWords);
        
        if(sections.length < sectionsRequired){
            const wordsNeeded = (sectionsRequired - sections.length)*20;
            return {
                error:{
                    message:`This text is not long enough for this task. About ${wordsNeeded} more words needed.`,
                    herp:'derp',
                    origin:'generateQuestions'
                }
            };
        }
        const sectionsWithVersions = addSectionVersions(sections);
        const sectionsWithIndexes = addSectionIndexes(sectionsWithVersions);
        const tagOb = getTagOb(filtered);
        const keywordsMarked = markKeywords(sectionsWithIndexes,tagOb,keywords);
        console.log('kwm',keywordsMarked.map(k=>k.keyword));
        const keywordIndexesIncluded = addKeywordIndexes(keywordsMarked);
        const questionSets = sliceIntoSets(keywordIndexesIncluded,task.questionCount);
        const trimmedQuestionSets = trimQuestionSets(questionSets,questionsPerSet);
        const errorOb = flattenArrayOfSets(trimmedQuestionSets).find(sec=>sec.error);
        
        if(errorOb){
            const {error} = errorOb;
            return {error};
        }

 
        const choicesAdded = addChoices(trimmedQuestionSets,distractorCount);
        const setIndexesAdded = addSetIndexes(choicesAdded);
        await addIllegalWords(setIndexesAdded,tagOb);
        addSetLemmas(setIndexesAdded);
        
        const exceptionWords = getExceptionWords(filtered);
        //const lemmaList = getLemmaList(filtered);
        
        const questions = flattenArrayOfSets(setIndexesAdded);

        for(let i=0,l=questions.length;i<l;i++){
            questions[i].sectionSynonyms = await getAllSynonyms(questions[i].illegalWords);
        }

        return questions.map((question,index)=>{
            question.task = task.id;
            question.text = text.id;
            question.index = index+1;
            question.sectionString = question.string.trim();
            question.correctChoice = question.keyword;
            question.exceptionWords = exceptionWords;
            question.setLemmas = getLemmaSlice(indexed,question.setStart,question.setEnd);
            question.sectionLemmas= getLemmasInOrder(question.sectionString);

            //question.illegalWords = addIllegalWords(question,tagOb);
            return question;
        });
    }
    catch(e){
        console.log('generateQuestions err',e);
    }
}

async function getQuestions(task){
    try{
        if(typeof task=='string'){
            task = await Task.findById(task);

        }
        let questions = await Question.find({task:task.id});
        if(!questions.length){
            questions = await generateQuestions(task);
            if(questions.error){
                const {error} = questions; 
                return {error};
            }
            for(let i=0,l=questions.length;i<l;i++){
                questions[i] = new Question(questions[i]);
                await questions[i].save()
            }
        }
        return questions;
    }
    catch(e){
        console.log('getQuestions err',e);
    }
}

function dealQuestions(questions,questionCount){
    const sets = sliceIntoSets(questions,questionCount);
    const drawn = drawItemsFromSets(2,sets);
    const hands = drawFromSetsIntoHands(drawn,2);
    
    return [...hands[0],...hands[1]];
}

async function generateResponses(room,task){
    try{
        const allQuestions = await getQuestions(task);
        if(allQuestions.error){
            const {error} = allQuestions; 
            return {error};
        }
        const withIDs = allQuestions.map(q=>{
            q.question = q.id;
            return q;
        });
        const responseCount = task.questionCount * 2;//(room.experimentalCondition == 'chat' ? 2 : 1)//task.questionCount * 2;//
        const detective = room.users.find(u=>u.role=='detective') || {};
        const witness = room.users.find(u=>u.role=='witness') || {};
        const responses = dealQuestions(withIDs,task.questionCount);
        for(let i=0,l=responseCount;i<l;i++){
            const username = room.experimentalCondition=='note' || room.experimentalCondition=='read' ? detective.username : (i + 1 <= task.questionCount ? detective.username : witness.username);
            const setIndex = responses[i].setIndex;
            const already = await Response.findOne({
                task:task.id,
                room:room.id,
                username,
                setIndex
            });

            const response = new Response();
            response.question = responses[i].id;
            response.setIndex = setIndex;
            response.task = task.id;
            response.text = task.text;
            response.index = i+1;
            response.room = room.id;
            response.experimentalCondition = room.experimentalCondition;
            response.username = username;//room.experimentalCondition=='note' ? detective.username : (i + 1 <= task.questionCount ? detective.username : witness.username);
            await response.save();
            responses[i] = response;
        }
        
        return responses;
    }
    catch(e){
        console.log('generateResponses err',e);
    }
}


function stripProps(ob,props){
    if(typeof props=='string'){
        props = props.split(',');
    }
    ob = JSON.parse(JSON.stringify(ob));
    props.forEach(p=>{
        delete ob[p];
    });
    return ob;
}

async function getResponses(room){
    try{
        if(!room){
            await checkIfUserNotThere({},'getResponses !room');
            return;
        }
        if(typeof room == 'string'){
            room = await Room.findById(room);
        }
        else{
            room = await Room.findById(room.id);
        }
        let responses = await Response.find({room:room.id});
        if(!responses.length){
            const task = await Task.findById(room.task);
            responses = await generateResponses(room,task);
            if(responses.error){
                const {error} = responses; 
                return {error};
            }
        }
        if(room.experimentalCondition!='chat'){
            return responses;
        }
        if(room.users.length > 1 && responses.find(r=>!r.username)){
            const newUser = room.users.find(u=>!responses.map(r=>r.username).includes(u.username));
            for(let i=0,l=responses.length;i<l;i++){
                const response = responses[i];
                if(response.username){
                    continue;
                }
                response.username = newUser.username;
                await response.save();
                responses[i] = response; 
            }
        }
        const anotherUser = room.users.find(u=>!responses.map(r=>r.username).includes(u.username));
        const task = await Task.findById(room.task);
        if(anotherUser){
            
            const role = anotherUser.role;
            for(let i=0,l=responses.length;i<l;i++){            
                if(role=='detective' && i + 1 > task.questionCount){
                    continue;
                }
                if(role=='witness' && i + 1 <= task.questionCount){
                    continue;
                }
                const response = new Response(stripProps(responses[i],'_id,responses,username,dateCreated,dateUpdated'));
                response.username = anotherUser.username;
                await response.save();
            }
        }
        let deletedExtraResponses = false;
        const usersDeletedFor = [];
        if(responses.length > task.questionCount*room.users.length){
            await Room.updateOne({_id:room.id},{$push:{log:'too many responses'}});
            for(let i=0,l=room.users.length;i<l;i++){
                const u = room.users[i];
                if(!u || !u.username){
                    console.log('no username for user ',u,'in room',room.id);
                    continue;
                }
                const rs = await Response.find({
                    username:u.username,
                    task: task.id,
                    room:room.id
                });
                if(rs.length > task.questionCount){
                    usersDeletedFor.push(u.username);
                    const ri = {};
    
                    for(let z = 0,c=rs.length;z<c;z++){
                        ri[rs[z].setIndex] = ri[rs[z].setIndex] ? ri[rs[z].setIndex] : [];
                        ri[rs[z].setIndex].push(rs[z]);
                    }
                    for(let key in ri){
                        const ers = ri[key];
                        ers.sort(function(b,a){return a.points-b.points;});
                        for(y=1,n=ers.length;y<n;y++){
                            await Response.deleteOne({_id:ers[y].id});
                        }
                    }
                    deletedExtraResponses = true;
                }
    
            }
        }
        if(deletedExtraResponses){
            const revisedResponses = await Response.find({
                task:task.id,
                room:room.id
            });
            await Room.updateOne({_id:room.id},{$push:{log:'deleted extra responses: '+usersDeletedFor.join(', ')}});
            return revisedResponses;
        }
        return responses;
    }
    catch(e){
        console.log('getResponses err',e);
    }
}

async function getResponse(socket,room){
    try{
        const responses = await getResponses(room);

        if(responses.error){
            const {error} = responses;
            return {error};
        }
        responses.sort((a,b)=>{return a.index - b.index;});
        const firstResponse = responses.find(r=>!r.complete);
        if(!firstResponse){
            return firstResponse;
        }
        const index = firstResponse.index;
        const otherResponse = responses.find(r=>r.index==index && r.username!=firstResponse.username);
        if(!otherResponse || otherResponse.complete){
            return firstResponse;
        }
        const user = room.users.find(u=>u.socketId==socket.id);
        const myResponse = [firstResponse,otherResponse].find(r=>r.username==user.username) || firstResponse;
        return myResponse;
    }
    catch(e){
        console.log('getResponse err',e);
    }
}

async function getQuestion(socket,room){
    try{
        const response = await getResponse(socket,room);
        if(!response){
            return response;
        }
        if(response.error){
            const {error} = response;
            return {error};
        }
        const question = await Question.findById(response.question);
        question.questionIndex = response.index;
        question.pointsPossible = response.pointsPossible;
        return question;
    }
    catch(e){
        console.log('getQuestion err',e);
    }
}

function getRandomChar(s){
    return s[Math.round(Math.random()*(s.length-1))];
}

function garbleText(string){
    const capAlph = "QWERTYUIOPASDFGHJKLZXCVBNM";
    const lowAlph = "qwertyuiopasdfghjkl";
    string = string.split('');
    for(let i=0,l=string.length;i<l;i++){
        if(string[i].match(/[A-Z]/)){
            string[i] = getRandomChar(capAlph.replace(string[i],''));
            continue;
        }
        if(string[i].match(/[weruioaszxcvnm]/)){
            string[i] = getRandomChar('weruioaszxcvnm'.replace(string[i],''));
            continue;
        }
        if(string[i].match(/[gqypj]/)){
            string[i] = getRandomChar('qypj'.replace(string[i],''));
            continue;
        }  
        if(string[i].match(/[ftdhkl]/)){
            string[i] = getRandomChar('tdhkl'.replace(string[i],''));
            continue;
        }
        if(string[i].match(/[!?]]/)){
            string[i] = getRandomChar('!?');
            continue;
        }
        if(string[i].match(/[,.]]/)){
            string[i] = getRandomChar(',.');
            continue;
        }   
    }
    return string.join('');
}

function getBlurredSectionWithKeword(sectionString,correctChoice){

    const match = sectionString.match(correctChoice);
    const start = match.index;
    const end = match.index + correctChoice.length;
    sectionString = garbleText(sectionString);
    return [sectionString.slice(0,start),sectionString.slice(start,end),sectionString.slice(end)];
}

async function getQuestionForRole(socket,room=false){
    try{
        const userNotThere = await checkIfUserNotThere(socket,'getQuestionForRole');
        if(userNotThere){
            return;
        }
        if(room===false){
            room = await Room.findOne({'users.socketId':socket.id});
        }
        const user = room.users.find(u=>u.socketId==socket.id);
        const task = await Task.findById(room.task);
        if(user.role=='detective' && room.users.length > 2 && room.users.filter(u=>u.role=='detective').length > 1){
            const responses = await getResponses(room);
            const response = await getResponse(socket,room);
            if(!response){
                return false;
            }
            if(response.error){
                return {error:response.error};
            }
            const question = await getQuestion(socket,room);
            const {choices} = question;
            //choices.sort(function(a,b){return a.keywordSectionIndexes[0] - b.keywordSectionIndexes[0];});
            
            if(responses.find(r=>r.index==response.index && r.username==user.username && r.complete)){
                return {
                    choices,
                    complete:true
                }
            }
        }
        const question = await getQuestion(socket,room);
        if(!question){
            return false;
        }
        const {questionIndex,pointsPossible,sectionStart,sectionEnd,choices} = question;
        choices.sort(function(a,b){return Math.random() - .5;});
        if(room.experimentalCondition=='note' || room.experimentalCondition=='read'){
            const response = await getResponse(socket,room);
            if(!response){
                return false;
            }
            if(response.error){

                return {error:response.error};
            }
            
            const {sectionNote,choiceNotes} = response;
            const question = await Question.findById(response.question);
            const {sectionString} = question;
            const correctChoice = isTestUser(user) ? question.correctChoice : '';
            const blurredSection = garbleText(sectionString);
            //question.choices.sort(function(a,b){return a.keywordSectionIndexes[0] - b.keywordSectionIndexes[0];});
            question.choices.sort(function(a,b){return Math.random() - .5;});
            const choiceNoteValues = !task.noWordNotes ? choiceNotes.map(c=>Object.values(c)[0]) : question.choices.map(q=>q.keyword);;
            const keywords = choiceNotes.map(c=>Object.keys(c)[0]);
            const blurredKeywords = keywords.map(c=>garbleText(c)); 
            const qOb = {
                questionIndex,
                blurredSection,
                sectionNote,
                blurredKeywords,
                choiceNotes:choiceNoteValues,
                pointsPossible,
                response,
                noWordNotes:task.noWordNotes,
                correctChoice
            }
            if(room.experimentalCondition=='read'){
                qOb.sectionStart = sectionStart;
                qOb.sectionEnd = sectionEnd;
                const correctChoiceOb = choices.find(c=>c.keyword==correctChoice);
                const {keywordIndexes} = correctChoiceOb;
                const keywordIndex = keywordIndexes.find(i=>i>=sectionStart && i<=sectionEnd);
                let blurStart = keywordIndex - 3;
                let blurEnd = keywordIndex+3;
                if(blurStart<sectionStart){
                    blurEnd = blurEnd + sectionStart-blurStart;
                    blurStart = sectionStart;
                }
                if(blurEnd>sectionEnd){
                    blurStart = blurStart - (blurEnd - sectionEnd);
                    blurEnd = sectionEnd;
                }
                qOb.blurStart = blurStart;
                qOb.blurEnd = blurEnd;
            }
            return qOb;
        }
        const correctChoice = isTestUser(user) ? question.correctChoice : '';
        return user.role=='detective' ? {questionIndex,choices,pointsPossible,correctChoice} :  {questionIndex,sectionStart,sectionEnd,pointsPossible,correctChoice};
    }
    catch(e){
        console.log('getQuestionForRole err',e);
    }
}

function getRoundEnds(room){
    return room.timeLimit ? Date.now() + (room.timeLimit*60*1000 + 6000) : 0;
}

async function updateRoomStats(io,room,response=false){
    try{
        room = await Room.findById(room.id);

        if(!room){
            console.log('no room at updateRoomStats');
            return;
        }
        const roomId = room.id;
        room = cloneData(room,'deleteId');
        room.id = roomId;
        const responses = await getResponses(room);
        if(response){
            room.currentResponder = response.username;
            room.currentQuestionIndex = response.index;
            room.currentResponseComplete = response.complete;
            room.currentResponseTries = response.responses.length;
            if(
                room.experimentalCondition=='chat' &&
                response.complete && 
                !responses.find(r=>r.index==response.index && 
                !r.complete) && 
                response.index==responses.reduce((m,r)=>{
                    m = r.index > m ? r.index : m;
                    return m;
                },0)/2
            ){
                room.users=room.users.map(u=>{
                    u.role=u.role=='detective'?'witness':'detective';
                    return u;
                });
                room.currentRound = 2;
                room.roundEnds = getRoundEnds(room);
                ['users','currentRound','roundEnds'].forEach(prop=>{
                    //room.markModified(prop);
                });
                

            }
        }
        if(!response){
            responses.sort((a,b)=>a.responses.count-b.responses.count);
            responses.sort((a,b)=>a.index-b.index);
            responses.sort((a,b)=>a.complete-b.complete);
            response = responses[0];
            const index = response.index;
            room.currentResponder = responses.filter(r=>r.index==index && !r.complete).length > 1 ? '' : response.username;
            room.currentQuestionIndex = response.index;
            room.currentResponseComplete = response.complete;
            room.currentResponseTries = response.responses.length;
        }
        const question = await Question.findById(response.question);
        if(!room.currentRound && (room.sequence.length==1 || !room.users.find(r=>r.currentStage!='task'))){//if(!room.currentRound && !room.users.find(r=>r.currentStage!='task')){//
            room.currentRound = 1;
            room.roundEnds = getRoundEnds(room);
            console.log('got roundEnds for ',room.users.map(u=>u.username).join(', '));
        }
        else{
            console.log('failed to get roundEnds for ',room.users.map(u=>u.username).join(', '));
            console.log('currentRound',room.currentRound);
            console.log('room.sequence',room.sequence);
            console.log(`room.users.find(r=>r.currentStage!='task')`,room.users.find(r=>r.currentStage!='task'));
        }
        room.illegalWords = question.illegalWords;
        room.exceptionWords = question.exceptionWords;
        room.sectionLemmas = question.sectionLemmas;
        room.sectionSynonyms = question.sectionSynonyms;
        room.setLemmas = question.setLemmas;
        room.setStart = question.setStart;
        room.setEnd = question.setEnd;
        room.sectionStart = question.sectionStart;
        room.pointsPossible = responses.reduce((sum,r)=>sum+=r.pointsPossible,0);
        room.currentPoints = responses.reduce((sum,r)=>sum+=r.points,0)+room.messagePoints;
        delete room.id;
        const updated = await Room.updateOne({_id:roomId},room);
        const currentRoom = await Room.findOne({_id:roomId});
        const {currentQuestionIndex,currentPoints,pointsPossible,task} = room;
        //io.in(`observing_${task}`).emit('report-room-progress',{
        //     room:roomId,
        //     currentQuestionIndex,
        //     currentPoints,
        //     pointsPossible,
        //     task
        // });
        return currentRoom;
    }
    catch(e){
        console.log('updateRoomStats err',e);
    }
}

async function updateRoomFromNote(room,note){
    try{
        room = await Room.findById(room.id);
        if(!room){
            console.log('no room at updateRoomFromNote');
            return;
        }
        const question = await Question.findById(note.question);
        room.illegalWords = question.illegalWords;
        room.exceptionWords = question.exceptionWords;
        room.sectionLemmas = question.sectionLemmas;
        room.sectionSynonyms = question.sectionSynonyms;
        room.setLemmas = question.setLemmas;
        room.setStart = question.setStart;
        room.setEnd = question.setEnd;
        room.sectionStart = question.sectionStart;
        await room.save();
    }
    catch(e){

    }
}

function getCurrentRoundQuestionIndex(currentQuestionIndex,currentRound,questionsPerRound){
    return currentQuestionIndex - (questionsPerRound * (currentRound-1));
}

async function processTimeUp(socket,room){
    try{
        const usernames = room.users.reduce((usernames,u)=>{
            u.role == 'detective' && usernames.push(u.username);
            return usernames;
        },[]);
        for(let i=0,l=usernames.length;i<l;i++){
            await Response.updateMany({room:room.id,username:usernames[i],complete:0},{complete:1,timeUp:1});
        }
        const responses = await Response.find({room:room.id,username:usernames[0]});
        const response = responses.sort(function(b,a){return a.index-b.index;})[0];
        return response;
        // const {currentQuestionIndex,currentRound,questionsPerRound} = room;
        // let currentRoundQuestionIndex = getCurrentRoundQuestionIndex(currentQuestionIndex,currentRound,questionsPerRound);
        
        
        // while(currentRoundQuestionIndex<=questionsPerRound){
        //     const response = await getResponse(socket,room);
        //     response.points = 0;
        //     response.complete = 1;
        //     response.timeUp = true;
        //     await response.save();
        //     if(currentRoundQuestionIndex==questionsPerRound){
        //         return response;
        //     }
        //     currentRoundQuestionIndex++;
        // }


    }
    catch(e){
        console.log('processTimeUp err',e);
    }
}

function getCorrectChoiceNoteFromResponseString(responseString,response){
    const note = response.choiceNotes.find(r=>Object.values(r)[0]==responseString);
    return Object.keys(note)[0];
}

async function processResponse(socket,room,responseString,specialConditions){
    try{
        if(specialConditions.timeUp){
            return await processTimeUp(socket,room);
        }
        const response = await getResponse(socket,room);
        if(!response){
            console.log('processResponse !resonse');
            return;
        }
        const {correctChoice} = await Question.findById(response.question);
        const task = await Task.findById(room.task);
        response.responses.push(responseString);
        responseString = response.experimentalCondition=='note' && !task.noWordNotes ? getCorrectChoiceNoteFromResponseString(responseString,response) : responseString;
        response.points = responseString == correctChoice && response.responses.length <= maxTries ? response.pointsPossible / response.responses.length : 0;
        response.complete = response.points > 0 || response.responses.length >= maxTries;
        await response.save();
        return response;
    }
    catch(e){
        console.log('processResponse err',e);
    }
}

async function getFeedbackAndUpdateRoomStats(io,socket,room,response){
    try{
        const {points} = response;
        const{correctChoice} = await Question.findById(response.question);
        room = await updateRoomStats(io,room,response);
        const nextResponse = await getResponse(socket,room);
        if(!nextResponse){
            return {next:'done', points, correctChoice};
        }
        if(nextResponse.index != response.index){
         
            if(room.experimentalCondition=='chat' && room.users.find(u=>u.username==response.username && u.role!='detective')){
                return {next:'switchRoles',points, correctChoice};
            }
            return {next:'nextQuestion', points, correctChoice};
        }
        if(nextResponse.username != response.username){
            return {next:'waitForOtherDetective', points};
        }
        return {next:'tryAgain', points};
    }
    catch(e){
        console.log('getFeedbackAndUpdateRoomStats err',e);
    }
}

async function sendRoomStats(io,room){
    try{
        room = await Room.findById(room.id);
        const {currentPoints,pointsPossible,currentRound,questionsPerRound,currentQuestionIndex} = room;
        io.in(room.id).emit('room-stats',{
            currentPoints,
            pointsPossible,
            currentRound,
            questionsPerRound,
            currentQuestionIndex
        });
    }
    catch(e){
        console.log('sendRoomStats err',e);
    }
}

function getSectionRandomization(half){
    const sectionRandomization = [];
    for(let i=0;i<half;i++){
        sectionRandomization.push(Math.round(Math.random()));
    }
    for(let i=0;i<half;i++){
        sectionRandomization.push(1-sectionRandomization[i]);
    }
    for(let i=0,l=sectionRandomization.length;i<l;i++){
        sectionRandomization[i] = (i%3) + (sectionRandomization[i] * half);
    }
    return sectionRandomization;
}

// function cloneData(mongooseOb){
//     ob = {};
//     let keys = Object.keys(mongooseOb.schema.paths);
//     keys.forEach(k=>{
//         ob[k] = mongooseOb[k];
//     });
//     ob.id = mongooseOb._id;
//     return JSON.parse(JSON.stringify(ob));
// }

async function generateNotes(room){
    try{
        const extraQuestionsPerSetCount = 1;
        const choicesToLeaveOut = 0;//1
        const notes = [];
        const questions = [];
        const responses = await getResponses(room);
        const origQuestions = await Question.find({task:room.task});
        const task = await Task.findById(room.task);

        for(let i=0,l=responses.length;i<l;i++){
            let question = origQuestions.find(q=>q.id==responses[i].question);
            const questionId = question.id;
            question = cloneData(question,'deleteId','deleteDates');
            question.question = questionId;
            question.id = questionId;
            question.response = responses[i].id;
            questions.push(question);
        }
        const totalQuestionsPerSetCount = origQuestions.filter(q=>q.setIndex==1).length;
        const currentQuestionsPerSetCount = questions.filter(q=>q.setIndex==1).length;
        const possibleExtraQuestionsPerSetCount = totalQuestionsPerSetCount - currentQuestionsPerSetCount;
        const realExtraQuestionsPerSetCount = extraQuestionsPerSetCount>possibleExtraQuestionsPerSetCount ? possibleExtraQuestionsPerSetCount : extraQuestionsPerSetCount;
        //origQuestions.sort(function(a,b){return Math.random()-.5;});
        let setIndex = 1;
        const mainQuestionIds = questions.map(q=>q.id);
        while(origQuestions.find(q=>q.setIndex==setIndex)){
            let extraQuestionCount = 0;
            while(extraQuestionCount < realExtraQuestionsPerSetCount && questions.length < origQuestions.length){
                let question = origQuestions.find(q=>q.setIndex==setIndex && !mainQuestionIds.includes(q.id));
                const questionId = question.id;
                question = cloneData(question,'deleteId','deleteTimes');
                question.question = questionId;
               // question.id = questionId;
                questions.push(question);//,'deleteId','deleteTimes'
                extraQuestionCount++;
            }
            setIndex++;
        }
        for(let i=0,l=questions.length;i<l;i++){
           // questions[i].question = questions[i].id;  
            questions[i].contentType = 'section';
            questions[i].content = questions[i].sectionString;
        }
        // const questionsPerSet = questions.filter(q=>q.setIndex==1).length;
        // questions.sort((a,b)=>{return Math.random()-.5;});
        // questions.sort((a,b)=>{return a.setIndex - b.setIndex;});
        // const origOut = [];
        // for(let i=0,l=questions.length;i<l;i++){  
        //     questions[i].order = ((i % questionsPerSet) * 100) + questions[i].setIndex;
        // }
        // questions.sort((a,b)=>{return a.order-b.order;});
        questions.sort(((a,b)=>{return a.sectionStart-b.sectionStart;}));
        const maxSetIndex = questions.reduce((max,q)=>{
            if(max<q.setIndex){
                max = q.setIndex;
            }
            return max;
        },0);
        const choices = [];
        
        if(!task.noWordNotes){
            for(let i=1;i<=maxSetIndex;i++){
                const question = questions.find(q=>q.setIndex==i);
                question.choices.sort((a,b)=>{return Math.random()-.5;});
                const choiceSet = question.choices.slice(choicesToLeaveOut).map(c=>{             
                    return {
                        contentType:'word',
                        setIndex:i,
                        content:c.keyword,
                        keywordIndexes:c.keywordIndexes,
                        question: origQuestions.find(q=>q.correctChoice==c.keyword).id
                    }
                });
                choices.push(...choiceSet);
            }
            choices.sort((a,b)=>{return a.setIndex - b.setIndex;});
            const choicesPerSetCount = choices.filter(c=>c.setIndex==1).length;
            for(let i=0,l=choices.length;i<l;i++){
                choices[i].order = ((i % choicesPerSetCount)*100)+choices[i].setIndex;
            }
            choices.sort((a,b)=>{return a.order-b.order;});
        }

        notes.push(...questions,...choices);
        for(let i=0,l=notes.length;i<l;i++){
            const note = new Note(notes[i]);
            note.index = i+1;
            note.noteCount = notes.length;
            note.task = room.task;
            note.room = room.id;     
            note.username = room.users[0].username;
            await note.save();
            notes[i] = note;
        }
        return notes;
    }
    catch(e){
        console.log('generateNotes',e);
    }

}


async function getNotes(room){
    try{
        const notes = await Note.find({task:room.task,username:room.users[0].username});
        if(notes.length){
            return notes;
        }
        return await generateNotes(room);
    }
    catch(e){
        console.log('getNotes err',e);
    }
}

async function getNote(room){
    try{
        if(!room.users){
            const socket = room;
            room = await Room.findOne({'users.socketId':socket.id});
        }
        if(room.experimentalCondition!='note' && room.experimentalCondition!='read'){
            return false;
        }
        const notes = await getNotes(room);
        if(notes.length){
            const note = notes.find(n=>!n.complete);
            if(note){
                return note;
            }
            return false;
        }
    }
    catch(e){
        console.log('getNote err',e);
    }

}

async function updateResponsesFromNote(note){
    try{
        if(note.contentType=='section' && !note.response){
            return false;
        }
        if(note.contentType=='section'){  
            const response = await Response.findById(note.response);
            response.sectionNote = note.note;
            await response.save();
            return response;
        }
        const {username,task,setIndex} = note;
        const responses = await Response.find({username,task,setIndex});
        for(let i=0,l=responses.length;i<l;i++){
            const response = responses[i];
            const choiceIndex = response.choiceNotes.reduce((index,c,i)=>{
                if(c[note.content]){
                    index = i;
                }
                return index;
            },-1);
            if(choiceIndex>-1){
                response.choiceNotes[choiceIndex][note.content]=note.note;
                response.markModified('choiceNotes');
                await response.save();
            }
            response.choiceNotes.push({[note.content]:note.note});
            response.markModified('choiceNotes');
            await response.save();
        }
        return responses;
    }
    catch(e){
        console.log('updateResponsesFromNote err',e);
    }
}

class QuestionResponse{

    constructor(){

    }
    async generateQuestions(task){
        return await generateQuestions(task);
    }
    async getQuestions(task){
        return await getQuestions(task);
    }
    async generateResponses(task){
        return await generateResponses(task);
    }
    async getResponses(room){
        return await getResponses(room);
    }
    async getResponse(socket,room){
        return await getResponse(socket,room);
    }
    async getQuestion(socket,room){
        return await getQuestion(socket,room);
    }
    async getQuestionForRole(socket,room){
        return await getQuestionForRole(socket,room);
    }
    async updateRoomStats(io,room,response){
        return await updateRoomStats(io,room,response);
    }
    async updateRoomFromNote(room,note){
        return await updateRoomFromNote(room,note);
    }
    async processResponse(socket,room,responseString,specialConditions){
        return await processResponse(socket,room,responseString,specialConditions);
    }
    async getFeedbackAndUpdateRoomStats(io,socket,room,response){
        return await getFeedbackAndUpdateRoomStats(io,socket,room,response);
    }
    async sendRoomStats(io,room){
        return await sendRoomStats(io,room);
    }
    async getQuestionsError(task){
        return await getQuestionsError(task);
    }
    async generateNotes(room){
        return await generateNotes(room);
    }
    async getNotes(room){
        return await getNotes(room);
    }
    async getNote(room){
        return await getNote(room);
    }
    async updateResponsesFromNote(note){
        return await updateResponsesFromNote(note)
    }

}

module.exports = new QuestionResponse();