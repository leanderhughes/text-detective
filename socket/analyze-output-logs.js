const testMode = require('../custom_modules/test-mode');
const Task = require('../models/Task');
const Text = require('../models/Text');
const {getLemmasInOrder,getLemmaList,getFunctionWordList} = require('../custom_modules/tag');
const Room = require('../models/Room');
const User = require('../models/User');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const Settings = require('../models/Settings');
const Proficiency = require('../models/Proficiency');
const SavedProficiency = require('../models/SavedProficiency');
const SavedResponse = require('../models/SavedResponse');
const Note = require('../models/Note');
const Question = require('../models/Question');
const Response = require('../models/Response');
const {checkIfTeacherNotThere} = require('../custom_modules/user-room');
const {getStats} = require('../custom_modules/stats');
const functionWordList = getFunctionWordList();


async function getGPStats(logLines,contentArray){
    try{
        const contentLems = getLemmaList(contentArray);
        const functionWordList = await getFunctionWordList();
    
        //logLines = logString.toLowerCase().split('\n').map(l=>l.split('\t'));
       // const {logLines,contentArray} = data;
        //linesWithStats = logLines;
        //socket.emit('got-gp-stats',{linesWithStats});
        return logLines.reduce((lines,l)=>{
            
            if(l[1]=='1'){
                const lems = getLemmasInOrder(l[0].slice(l[0].indexOf(':')));
                const original = lems.filter(m=>contentLems.indexOf(m)==-1 && m.indexOf('_')==-1);  
                const originalStrict = original.filter(o=>functionWordList.indexOf(o)==-1);
                l.push(...[
                    lems.length,
                    original.length,
                    Math.round(original.length*10000/lems.length)/100,
                    originalStrict.length,
                    Math.round(originalStrict.length*10000/lems.length)/100,
                    originalStrict.join(' ')
                ]);
                lines.push(l);
                return lines;
            }
            l.push('','','','','','');
            lines.push(l);
            return lines;
        },[]);
        //console.log('logLines',logLines.length);
    }
    catch(e){
        console.log('getGPStats err',e);
    }

}


module.exports = function analyzeOutputLogs(io,socket){

    socket.on('get-gp-stats',async(data)=>{
        try{
            const {logLines,contentArray} = data;
            const linesWithStats = await getGPStats(logLines,contentArray);
            socket.emit('got-gp-stats',{linesWithStats});
        }
        catch(e){
            console.log('start-observation err',e);
        }
    });
    socket.on('###',async(data)=>{
        try{
       
        }
        catch(e){
            console.log('start-observation err',e);
        }
    }); 
    return socket;
}