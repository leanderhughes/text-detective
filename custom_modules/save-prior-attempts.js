const Response = require('../models/Response');
const Proficiency = require('../models/Proficiency');
const SavedResponse = require('../models/SavedResponse');
const SavedProficiency = require('../models/SavedProficiency');
const Note = require('../models/Note.js');
const SavedNote = require('../models/SavedNote.js');
const Room = require('../models/Room');
const SavedRoom = require('../models/SavedRoom');
const cloneData = require('./clone-data');

const models = {
    Response,
    Proficiency,
    SavedResponse,
    SavedProficiency,
    Note,
    SavedNote,
    Room,
    SavedRoom
}

async function saveClosedRooms(data){

}
async function savePriorAttempt(data){
    let errorOccurred = false;
    try{
        
        const {model,task,username} = data;
        let completed = await models[model].find({task,username,complete:true});
        if(!completed.length){
            return 0;
        }
        for(let i=0,l=completed.length;i<l;i++){
            const copy = cloneData(completed[i],'deleteId');
            const doc = new models[`Saved${model}`](copy);
            await doc.save();
        }
        await models[model].deleteMany({task,username,complete:true});
        return completed.length;
    }
    catch(e){
        errorOccurred = true;
        console.log('savePriorAttempt err',e);
    }
}

async function savePriorAttempts(data){
    try{
        const {task,username}= data;//taskId
        const res =  {
            response: await savePriorAttempt({model:'Response',task,username}),
            proficiency: await savePriorAttempt({model: 'Proficiency',task,username}),
            note: await savePriorAttempt({model: 'Note',task,username})
        }
        return res;
    }
    catch(e){
        console.log('savePriorAttempts err');
    }

}

module.exports = savePriorAttempts;