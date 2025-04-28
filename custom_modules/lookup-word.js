const enToJpDict = require('../static_serverside/en-to-jp-dict');
const wordsetDictionary = require('../static_serverside/wordset-dictionary').allWords;
const {getPos,getLem,tagSentence} = require('./tag');
const {googleTranslate,googleImageSearch,googleSearch} = require('./google.js');
const {getRoom} = require('./user-room');
const Text = require('../models/Text');
const Task = require('../models/Task');


function getValString(ob,pos){
    console.log('pos',pos);
    pos = pos ? pos[0].toLowerCase() : '';
    const trans = [];
    ob[pos] && trans.push(ob[pos]);
    for(let key in ob){
        if(key==pos){
            continue;
        }
        trans.push(ob[key]);
    }
    return trans.join('\n');
}


function getJp(word,pos){
    const noTrans = '(no translation)';
    if(!word){
        return noTrans;
    }
    const low = word.toLowerCase();
    const trans = enToJpDict[low];
    if(trans){
        return getValString(trans,pos);
    }
    const lem = getLem(word);
    return enToJpDict[lem] ? `${lem}->\n${getValString(enToJpDict[lem],pos)}` : noTrans;
}


function getDictionaryInfo(word){
    const noDef = {meanings:[]};
    if(!word){
        return noDef;
    }
    const low = word.toLowerCase();
    const def = wordsetDictionary[low];
    if(!def){
        return noDef;
    }
    const lem = getLem(low);
    return wordsetDictionary[lem] ? wordsetDictionary[lem] : noDef;
}

async function lookupWord(socket,word,index,context=false){
    try{
        // word = word && typeof word == 'string' ? word.toLowerCase() : word;
        // const room = await getRoom(socket);
        // const task = await Task.findById(room.task);
        // const text = await Text.findById(task.text);
        // const pos = text.pos[index-1];

        const tagInfo = tagSentence(context ? context : word);
        const pos = tagInfo.find(item=>item.value==word).pos;
        const translation = getJp(word,pos);
        
        //const definitions = dictionaryInfo.meanings.map(d=>d.def);
        //const definition = definitions[0] || '(no definition)';
        // const images = await googleImageSearch(word);
        // const google = await googleSearch(word,'image','icon clipart');
        return {
            word,
            translation,
            pos,
            tagInfo
        };
    }
    catch(e){
        console.log('lookupWord err',e);
    }
}

class LookupWord{
    constructor(){

    }
    getJp(word){
        return getJp(word);
    }
    async lookupWord(socket,word,index,context){
        return await lookupWord(socket,word,index,context);
    }
    getDictionaryInfo(word){
        return getDictionaryInfo(word);
    }
}

module.exports = new LookupWord();
//lexer js for clientside alternative to tag https://github.com/dariusk/pos-js