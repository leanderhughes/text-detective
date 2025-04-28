const posTagger = require( 'wink-pos-tagger' );
const { next } = require('../static_serverside/nex');
const nex = require('../static_serverside/nex');
const alternativeSpellings = require('../static_serverside/alternative-spellings');

const Settings = require('../models/Settings'); 


function addReductsToNex(){
    const reducts = {
                        "m":"am","ve":'have',"d":'would',"ll":'will',"re":'are','wo':'will',
                        "'m":"am","'ve":'have',"'d":'would',"'ll":'will',"'re":'are','wo':'will'
                    };
    Object.keys(reducts).forEach(key=>{
        nex[key] = nex[reducts[key]];
    })
}

addReductsToNex();

function alternativeSpelling(word){
    if(!word){
        return;
    }
    word = word.toLowerCase();
    return alternativeSpellings[word] ? alternativeSpellings[word] : false;
}


const cocaTotalWordCount = 468011313;
const serviceList = ['ngsl_1','ngsl_2','ngsl_3','tsl'].reduce((list,listName,index)=>{
    const words = require(`../static_serverside/${listName}`);
    words.forEach(w=>list[w]=index+1);
    return list;
},{});
const naughty = require('../static_serverside/naughty').reduce((ob,w)=>{
    ob[w]=1;
    return ob;
},{});
const tagger = posTagger();

function tagSentence(string){
    return tagger.tagSentence(
        string.replace(/n[\'’ ]t\b/gi,' not')
        .replace(/\bit[\'’ ]s\b/gi,'it is')
        .replace(/\bwhat[\'’ ]s\b/gi,'what is')
        .replace(/\bhow[\'’ ]s\b/gi,'how is')
        .replace(/\bthat[\'’ ]s\b/gi,'that is')
        .replace(/\bthis[\'’ ]s\b/gi,'this is')

    );
}


function filterFormat(delta){
    const strings = delta.reduce((items,item)=>{
        if(!item || item.ignore){
            return items;
        }
        items.push(item);
        return items;
    },[]);
    const combined = [];
    for(let i=0,l=strings.length;i<l;i++){
        if(strings[i].length==1 && strings[i+1] && strings[i].match(/\W/) && strings[i+1].match(/\s/)){
            combined.push(strings[i]+strings[i+1]);
            i++;
            continue;
        }
        combined.push(strings[i]);
    }
    return combined;
}

function getListStatus(word,rangeFrom=false,rangeTo=false){
    if(rangeFrom===false){
        return serviceList[word];
    }
    return serviceList[word] && rangeFrom >= serviceList[word] && serviceList[word] <= rangeTo ? serviceList[word] : false;
}

function freq(word){
    if(!word){
        return 0;
    }
    word = word.toLowerCase();
    return nex[word] ? nex[word].all.fre : 1;
}



function getLemma(string){
    if(!nex[string]){
        const altSpelling = alternativeSpelling(string);
        if(altSpelling && nex[altSpelling]){
            return nex[altSpelling].any.lem;
        }
        return string;
    }
    return nex[string].any.lem;
}


function getRawImportance(lemma,textFreq,lemmaCount,cocaFreq,pos,onList){
    if(naughty[lemma]){
        return 0;
    }
    let importance = nex[lemma] ? Math.round((textFreq/lemmaCount) / cocaFreq) : 1;
    return importance;
}

function getImportance({lemma,textFreq,lemmaCount,cocaFreq,pos,strictModeOff}=data){
    if(naughty[lemma]){
        return 0;
    }
    let importance = nex[lemma] && pos[0].match(/[NVJnvj]/) ? Math.round((textFreq/lemmaCount) / cocaFreq) : 1;
    return importance;
}

function getPos(lemma,pos){
    if(pos=='NNP' || pos=='NNPS'){
        return 'PN';
    }
    if(!nex[lemma]){
        return pos;
    }
    const posChar = pos[0].toLowerCase();
    if(nex[lemma].all.pos.find(p=>p[0]==posChar)){
        return pos;
    }
    return nex[lemma].any.pos[0].toUpperCase();
}

const numberWords = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventh','eighteenth','nineteenth','twentieth','thirtieth','fortieth','fiftieth','sixtieth','seventieth','eightieth','ninetieth'];


function hasNumber(word){
    if(!word){
        return word;
    }
    if(word.match(/\d/)){
        return true;
    }
    if(numberWords.includes(word.toLowerCase())){
        return true;
    }
    return false;
}

function offList(word){
    return !nex[word.toLowerCase()];
}

const illegalChars = /[^a-zA-Z0-9\-\.\?,\(\)&\%\$\!\:\;\"\'\s\^\~\*\+\/\<\>\_\[\]\=\$\%\&\#]/;

function hasIllegalChars(string){
    return string.match(illegalChars);
}



function returnIllegalChars(){
    return illegalChars;
}


function foundIllegalWord(string,lemmaOb,illegalWordExceptions,exceptions,inclusions=[]){
    if(!string){
        return false;
    }
    if(hasIllegalChars(string)){
        return 'illegalChars';
    }
    if(string.match(/\w/)){

        const lemma = lemmaOb[string];

        if(illegalWordExceptions.includes(lemma)){
            return false;
        }

        if(inclusions.includes(lemma)){
            return 'illegalWord';
        }
        if(exceptions.includes(lemma)){
            return false;
        }

        if(hasNumber(string)){
            return 'hasNumber';
        }
        if(offList(string)){
            return 'offList';
        }
        if(['sentence','paragraph'].includes(lemma)){
            return 'textLocator';
        }
    }
    return false;
}

function getLemmaOb(ar){
    return tagSentence(getStringFromWordArray(ar)).reduce((lemmas,item)=>{
        if(!item.value.match(/\w/)){
            return lemmas;
        }
        const lemma = getLemma(item.lemma || item.normal);
        lemmas[item.value] = lemma;
        return lemmas;
    },{}); 
}

function getIndexOb(lems){
    return lems.reduce((ob,lem,index)=>{
        ob[lem] = ob[lem] ? ob[lem] : [];
        ob[lem].push(index+1);
        return ob;
    },{});
}

function getLemOverlapHits(newLems,origLems){
    if(newLems.length==1 || origLems.length==1){
        if(origLems.includes(newLems[0])){
            return [1];
        }
        if(newLems.includes(origLems[0])){
            return [1];
        }
    }

    const indexOb = getIndexOb(origLems);
    const indexes = newLems.map(l=>indexOb[l] || [-1]);
    const hits = indexes.map((inds,index,ar)=>{
        if(!index && inds.find(i=>i==1)){
            return 1;
        }
        const next = ar[index+1];
        if(next){
            if(inds.find(i=>next.includes(i+1))){
                return 1;
            }
        }
        const previous = ar[index-1];
        if(previous){
            if(inds.find(i=>previous.includes(i-1))){
                return 1;
            }
        }
        return 0;
    });
    return hits;

}

function getStartAndEndOfHitsOverThresh(hits,hitSpan,thresh){
    let exitedThresh = false;
    const minHalfHitSpan = hitSpan;
    return hits.reduce((startEnd,item,index,array)=>{
        if(exitedThresh){
            return startEnd;
        }
        const seg = array.slice(index,index+hitSpan);
        if(seg.length < minHalfHitSpan && !startEnd.end){
            startEnd.end = index;
            exitedThresh = true;
            return startEnd;
        }
        if(seg.length < minHalfHitSpan){
            exitedThresh = true;
            return startEnd;
        }
        const ratio = seg.reduce((sum,item)=>sum+=item,0) / seg.length;
        if(startEnd.start && startEnd.end && ratio < thresh){
            exitedThresh = true;
            return startEnd;
        }
        if(ratio > thresh && !startEnd.start){
            startEnd.start = index + seg.indexOf(1)+1;
            //return startEnd;
        }
        if(ratio > thresh){
            startEnd.end = index + seg.lastIndexOf(1) + 1;
            //return startEnd;
        }
        return startEnd;
    },{start:0,end:0});
}

function getLemOverlap(newLems,origLems,thresh=5/10,startIndexOffset=1){
    startIndexOffset = startIndexOffset - 1;
    const hits = getLemOverlapHits(newLems,origLems);
    const hitSpan = [newLems.length,origLems.length].reduce((hitSpan,len)=>{
        if(len<hitSpan){
            return len;
        }
        return hitSpan;
    },10);
    const {start,end} = getStartAndEndOfHitsOverThresh(hits,hitSpan,thresh);
    if(!start){
        return false;
    }
    return {
        start: start+startIndexOffset,
        end: end+startIndexOffset
    };
}

function getOverlap2ForSingleWord(newLems,overlap1,origLems,startIndexOffset){
    const word = newLems[overlap1.start-1];
    for(let i=0,l=origLems.length;i<l;i++){
        if(word==origLems[i]){
            const index = i + startIndexOffset;
            return {start:index,end:index};

        }
    }
    return ['error','error'];
}

function getLemOverlaps(newLems,origLems,thresh,startIndexOffset){
    const overlap1 = getLemOverlap(newLems,origLems,thresh);
    if(!overlap1){
        return false;
    }
    let overlap2 = getLemOverlap(origLems,newLems,thresh,startIndexOffset);
    if(!overlap2){
        return false;
    }
    if(overlap1.start==overlap1.end && overlap2.start==overlap2.end){
        overlap2 = getOverlap2ForSingleWord(newLems,overlap1,origLems,startIndexOffset);
    }
    return [overlap1,overlap2];
}

function getStringOverlap(newString,origString,thresh){
    return getLemOverlap(getLemmasInOrder(newString),getLemmasInOrder(origString),thresh);
}

function getStringOverlaps(newString,origString,thresh){
    return getLemOverlaps(getLemmasInOrder(newString),getLemmasInOrder(origString),thresh);
}

function getStringLemOverlaps(newString,origLems,thresh,startIndexOffset){
    return getLemOverlaps(getLemmasInOrder(newString),origLems,thresh,startIndexOffset);
}

function getStringFromWordArray(ar){
    return typeof ar!='string' ? ar.join((ar.includes(' ') ? '' : ' ')) : ar;
}

function getLemmasInOrder(ar){
    return tagSentence(getStringFromWordArray(ar)).reduce((lemmas,item)=>{
        if(!item.value.match(/\w/)){
            return lemmas;
        }
        const lemma = getLemma(item.lemma || item.normal);
        lemmas.push(lemma);
        return lemmas;
    },[]); 
}

function getPosInOrder(ar){
    return tagSentence(getStringFromWordArray(ar)).reduce((pos,item)=>{
        if(!item.value.match(/\w/)){
            return pos;
        }
        const lemma = getLemma(item.lemma || item.normal);
        pos.push(getPos(lemma,item.pos));
        return pos;
    },[]); 
}

function getRandomWord(startString=false,len=false){
    len = len === false ? Math.round(Math.random()*4.5+Math.random()*4.5+(Math.random()<.2 ? Math.random()*4.5 : 0))+1 : len;
    const keys = Object.keys(nex);
    for(let i=0,l=keys.length;i<l;i++){
        const key = keys[i];
        if(startString && key.slice(0,startString.length)==startString && Math.random() < .33){
            return key;
        }
        else if(!startString && key.length==len && Math.random() < .12){
            return key;
        }
    }
    return keys.pop();
}

function getRandomWords(len=false,wordLen = false){
    len = len === false ? Math.round(Math.random()*11)+ 1 : len;
    let i = -1;
    const words = [];
    while(i < len){
        words.push(getRandomWord(false,wordLen)+(Math.random() < .12 ? '.' : '')+(Math.random() < .12 ? '?' : ''));
        i++;
    }
    return words.join(' ');
}


class Tag{
    constructor(){

    }
    freq(string){
        return freq(string);
    }
    offList(string){
        return offList(string);
    }
    getTagOb(ar,strictModeOff=false){

                
        const lemmaCountOb = {};
        const normalCountOb = {};

        function countLemma(string){
            lemmaCountOb[string] = lemmaCountOb[string] ? lemmaCountOb[string] : 0;
            lemmaCountOb[string]++;
            return lemmaCountOb[string];
        }

        function getLemmaCount(string){
            return lemmaCountOb[string] ? lemmaCountOb[string] : 0;
        }

        function countNormal(string){
            normalCountOb[string] = normalCountOb[string] ? normalCountOb[string] : 0;
            normalCountOb[string]++;
            return normalCountOb[string];
        }

        function getNormalCount(string){
            return normalCountOb[string] ? normalCountOb[string] : 0;
        }



        let textWordCount = 0;
        const tagged = tagSentence(getStringFromWordArray(ar)).map((item,index)=>{
            if(!item.value.match(/\w/)){
                item.ignore = true;
                return item;
            }
            textWordCount++;

            item.lemma = getLemma(item.lemma || item.normal);
            item.pos = getPos(item.lemma,item.pos);
            item.fre = freq(item.lemma);
            item.cocaFreq = 10000 * freq(item.lemma) / cocaTotalWordCount;
            item.index = index+1;
            countLemma(item.lemma);
            countNormal(item.normal);
            return item;
        });
        const taggedAndOrdered = tagged.map(item=>{
            if(item.ignore || (item.value && item.value.match(/\d/))){
                item.importance = 0;
                return item;
            }
            item.lemmaCount = getLemmaCount(item.lemma);
            item.normalCount = getNormalCount(item.value);
            item.textFreq = 10000 * getLemmaCount(item.lemma) / textWordCount;
            item.onList = getListStatus(item.lemma);
            const {lemma,textFreq,lemmaCount,cocaFreq,pos,onList} = item;
            item.rawImportance = getRawImportance(lemma,textFreq,lemmaCount,cocaFreq,pos,onList);
            item.importance = !strictModeOff && item.normalCount!=1 ? 0 : getImportance({lemma,textFreq,lemmaCount,cocaFreq,pos,onList,strictModeOff});
            
            return item;
        }).sort((b,a)=>a.importance-b.importance).reduce((tagOb,item)=>{
            if(!item.value){
                return tagOb;
            }
            if(tagOb[item.value]){
                return tagOb;
            }
            tagOb[item.value]=item;
            return tagOb;
        },{});
        Object.keys(taggedAndOrdered).forEach(k=>{
            const t = taggedAndOrdered[k];
            //console.log(t.value,t.importance);
        });
        return taggedAndOrdered;
    }
    tagSentence(string){
        return tagSentence(string);
    }
    getLemmaList(ar){
        return tagSentence(getStringFromWordArray(ar)).reduce((lemmas,item)=>{
            if(!item.value.match(/\w/)){
                return lemmas;
            }
            const lemma = getLemma(item.lemma || item.normal);
            if(lemmas.includes(lemma)){
                return lemmas;
            }
            lemmas.push(lemma);
            return lemmas;
        },[]);       
    }
    getLemmasInOrder(ar){
        return getLemmasInOrder(ar);
    }
    getPosInOrder(ar){
        return getPosInOrder(ar);
    }
    getLemma(string){
        return getLemmasInOrder([string])[0];
    } 
    getLem(string){
        return getLemma(string);
    } 
    getLemmaOb(ar){
        return getLammaOb(ar);
    }
    getOffListLemmas(lemmas){
        return lemmas.filter(lemma=>offList(lemma));
    }
    // getLemOverlap(newLems,origLems,thresh){
    //     return getLemOverlap(newLems,origLems,thresh);
    // }
    // getStringOverlap(newString,origString,thresh){
    //     return getStringOverlap(newString,origString,thresh);
    // }
    getLemOverlaps(newLems,origLems,thresh){
        return getLemOverlaps(newLems,origLems,thresh);
    }
    getStringOverlaps(newString,origString,thresh){
        return getStringOverlaps(newString,origString,thresh);
    }
    getStringLemOverlaps(newString,origLems,thresh,startIndexOffset=0){
        return getStringLemOverlaps(newString,origLems,thresh,startIndexOffset);
    }
    async findIllegalWords(message,sectionLems=false,setLems=false,exceptions=[],inclusions=[]){
        try{
            const settings = await Settings.findOne({});
            const {illegalWordExceptions} = settings;
            let tagged = '';
            if(typeof message == 'string'){
                tagged = tagSentence(message);
                message = tagged.map(item=>item.value);
            }
            const lemmaOb = getLemmaOb(message);
            const errors = message.reduce((errors,item)=>{
                const error = foundIllegalWord(item,lemmaOb,illegalWordExceptions,exceptions,inclusions);
                if(error){
                    errors[item] = error;
                }
                return errors;
            },{});
            if(Object.keys(errors).length){
                return errors;
            }
            return false;
        }
        catch(e){
            console.log('findIllegalWords err',e);
        }
     
    }
    // getNexFre(string){//see freq
    //     if(!string){
    //         return;
    //     }
    //     return nex[string] ? next[string].any.fre : 0;
    // }
    getSyllableCount(string){
        if(!string){
            return;
        }
        return string.replace(/[aeoui]{1,10}/gi,'i').replace(/[qwrtypsdfghjklzxcvbnm]{1,10}/gi,'k').length/2;
    }
    alternativeSpelling(word){
        return alternativeSpelling(word);
    }
    filterFormat(delta){
        return filterFormat(delta);
    }
    returnIllegalChars(){
        return returnIllegalChars();
    }
    getRandomWord(startString=false,len=false){
        return getRandomWord(startString,len);

    }
    getRandomWords(len=false,wordLen=false){
        return getRandomWords(len,wordLen);
    }
    async getIllegalWordExceptions(){//OKwords
        try{

            const settings = await Settings.findOne({});
            if(!settings){
                console.log('etIllegalWordExceptions Settings? ',settings);
                return {};
            }
            const {illegalWordExceptions} = settings;
            return illegalWordExceptions;
        }
        catch(e){
            console.log('getIllegalWordExceptions / getFunctionWordList err',e);
        }
    }
    async getFunctionWordList(){
        try{
            const settings = await Settings.findOne({});
            const {illegalWordExceptions} = settings;
            if(!settings){
                console.log('etIllegalWordExceptions Settings? ',settings);
                return {};
            }
            return illegalWordExceptions;
        }
        catch(e){
            console.log('getIllegalWordExceptions / getFunctionWordList err',e);
        }   
    }
}

module.exports = new Tag();
////lexer js for clientside alternative to tag https://github.com/dariusk/pos-js