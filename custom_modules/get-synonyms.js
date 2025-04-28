var wordnet = require('wordnet');
const getDictionaryInfo = require('./lookup-word').getDictionaryInfo;
const {getTagOb, getLemmasInOrder,freq,getLemmaList,offList} = require('./tag');



function wordnetLookup(word){
    return new Promise((resolve,reject)=>{
        wordnet.lookup(word,(err,definitions)=>{
            if(err){

                return reject(false);
            }
            return resolve(definitions);
        });
    });
}
  
function objectPush(mainOb,obToAdd){
    for(let key in obToAdd){
        mainOb[key] = obToAdd[key];
    }
    return mainOb;
}
function cleanWord(word){
    return word.replace(/_/g,' ').replace(/\([a-zA-Z]{1,100}\)/g,'').replace(/one\'s/ig,'...');
}
function getMinFreq(ar){
    const minFreq = ar.reduce((minFreq,wordFreq)=>{
        const fre = parseFloat(wordFreq.replace(/_1\D/g,'').replace(/[^0-9\.]/g,''));
        minFreq = fre < minFreq ? fre : minFreq;
        return minFreq;
    },Infinity);
    return minFreq;
}

function cleanWordPhrase(string){
    if(!string || typeof string != 'string'){
        return string;
    }
    return string.replace(/\([\s\S]{1,100}\)/g,'').replace(/_/g,' ');
}

function getWordPhrases(definition){
    const wordPhrases = [];
    const gloss = definition.glossary ? cleanWordPhrase(definition.glossary.split(';')[0]) : false;
    gloss && !wordPhrases.includes(gloss) && wordPhrases.push(gloss);
    definition.meta && definition.meta.words && definition.meta.words.length && definition.meta.words.forEach(wordPhrase=>{
        wordPhrase.word = cleanWordPhrase(wordPhrase.word);
        !wordPhrases.includes(wordPhrase.word) && wordPhrases.push(wordPhrase.word);
    });
    return wordPhrases;
}

async function getRelatedWordPhrases(word){
    try{
        if(offList(word)){
            return [];
        }
        const definitions = await wordnetLookup(word);
        return [...new Set(
            definitions.reduce((wordPhrases,definition)=>{
                // definition.glossary && !wordPhrases.includes(definition.glossary.split(';')[0]) && wordPhrases.push(definition.glossary.split(';')[0]);
                // definition.meta && definition.meta.words && definition.meta.words.length && definition.meta.words.forEach(wordPhrase=>{
                //     !wordPhrases.includes(wordPhrase.word) && wordPhrases.push(wordPhrase.word);
                // });
                wordPhrases.push(...getWordPhrases(definition));
                definition.meta && definition.meta.pointers && definition.meta.pointers.forEach(pointer=>{
                    const data = pointer.data;
                    wordPhrases.push(...getWordPhrases(data));
                });
                return wordPhrases;
            },[]))
        ];
    }
    catch{

    }
}







async function old_getSynonyms(word){
    try{
        const wordPhrases = await getRelatedWordPhrases(word);
        if(!wordPhrases || !wordPhrases.length){
            return [];
        }
        const lemmas = getLemmasInOrder(wordPhrases);
        const count = {};
        return lemmas.reduce((words,word)=>{
            words.push({word:word,fre:freq(word)});
            count[word] = count[word] ? count[word] : 0;
            count[word]++;
            return words;
        },[])
        .map(ob=>{
            ob.count = count[ob.word];
            return ob;
        })
        .filter(ob=>{//decide which words to keep based on coca frequency
            return (ob.fre < 100000 && ob.count > 1) || (ob.count > 1 && ob.fre < 900000 && (ob.count * 100000 / ob.fre > 1.5))
        })
        .sort((b,a)=>{return a.fre-b.fre;})
        .reduce((words,ob)=>{
            ob.word != word && !words.includes(ob.word) && words.push(ob.word);
            return words;
        },[]);
    }
    catch(e){
        console.log('lookup',e);
    }
}

function getSynonyms(word){
    const dictionaryInfo = getDictionaryInfo(word);
    if(!dictionaryInfo || !dictionaryInfo.meanings || !dictionaryInfo.meanings.length){
        return [];
    }
    return [...new Set(dictionaryInfo.meanings.reduce((all,s)=>{
            if(!s.synonyms){
                return all;
            }
            all.push(...s.synonyms);
            return all;
        },[]))
    ];
}

module.exports=getSynonyms;


/*

Plan for synonym rewards

add section keywords

sectionSynonyms:{
    keyword:[synomyms]
},
synonymsUsed:[synonyms],
synonymRewards:{
    lemma:[userindexes]
}


*/

