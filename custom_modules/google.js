const testMode = process.env.NODE_ENV !== 'production';
if(testMode){
    require('dotenv').config();
}
const { google } = require('googleapis');
 const customsearch = google.customsearch('v1');

 const {ggApiKey,ggCx} = require('../config_for_game/google');
 const auth = ggApiKey;
 const cx = ggCx;

 const key = ggApiKey;

  async function googleSearch(q='apples and oranges',searchType=false,imageType=false,start=1,num=3){
    //const { q, start, num } = req.query;
    if(imageType){
        q = `${q} ${imageType}`;
    }
    const params = {
        auth,
        cx,
        q,
        key,
        tbm:'isch'
    };
    // if(searchType=='image'){
    //     params.tbm = 'isch';
    // }
    try{
        const res1 = await customsearch.cse.list(params);
        const res2 = res1.data;
        const { queries, items, searchInformation } = res2;

        const page = (queries.request || [])[0] || {};
        const previousPage = (queries.previousPage || [])[0] || {};
        const nextPage = (queries.nextPage || [])[0] || {};

        return {
            q,
            totalResults: page.totalResults,
            count: page.count,
            startIndex: page.startIndex,
            nextPage: nextPage.startIndex,
            previousPage: previousPage.startIndex,
            time: searchInformation.searchTime,
            items: items.map(o => ({
            link: o.link,
            title: o.title,
            snippet: o.snippet,
            img: (((o.pagemap || {}).cse_image || {})[0] || {}).src
            }))
        }
        // res.status(200).send(result);
        //res.status(200).send(data);
    }
    catch(err){
        console.log('googleSearch err',err);
    }

 }

 async function googleImageSearch(q='apples and oranges',imageType="clipart",start=1,num=3){
    try{
        const result = await googleSearch(q,'image',imageType,start,num);
        return !result || !result.items ? [] : result.items.map(i=>i.img);
    }
    catch(e){
        console.log('googleImageSearch err',e);
    }
    
 }

 //googleSearch();

 const {Translate} = require('@google-cloud/translate').v2;

 const projectId = 'text-detective';



 //AIzaSyBk3acK6XvEK5XRO_OvovytuLDttA0qrlc
 
 // Creates a client
 const translate = new Translate({projectId,key});
 
 /**
  * TODO(developer): Uncomment the following lines before running the sample.
  */
 // const text = 'The text to translate, e.g. Hello, world!';
 // const target = 'The target language, e.g. ru';
 
 async function googleTranslate(text,target='ja') {
     try{



     
    // Translates the text into the target language. "text" can be a string for
    // translating a single piece of text, or an array of strings for translating
    // multiple texts.
        let [translations] = await translate.translate(text, target);
        translations = Array.isArray(translations) ? translations : [translations];
        console.log('Translations:');
 

        return translations.map(`${text[i]} => (${target}) ${translation}`);

    }
    catch(e){
        console.log('trAns err',e)
    }
 }
 
 //translateText('What am I saying?');//17*2

 class Google {
     constructor(){

     }
     async googleTranslate(string,target='ja'){
        return await googleTranslate(string,target);
     }
     async googleImageSearch(string,imageType='clipart icon',start=1,num=10){
         return await googleImageSearch(string,imageType,start,num);
     }
     async googleSearch(string,searchType=false,imageType=false,start=1,num=10){
         return await googleSearch(string,'image','clipart icon',start=1,num=10);
     }
 }

 module.exports = new Google();