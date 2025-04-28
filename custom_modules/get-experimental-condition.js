const User = require('../models/User');
const Settings = require('../models/Settings');
const Task = require('../models/Task');

async function getExperimentalCondition(username,taskId=false){
    try{

        const settings = await Settings.findOne({});
        const user = await User.findOne({username});
        if(!taskId){
            return settings.experimentalAssignment[user.experimentalGroup];
        }
        const task = await Task.findOne({_id:taskId});
        if(!task || !task.experimentalAssignment || !task.experimentalAssignment.length){
            return settings.experimentalAssignment[user.experimentalGroup];
        }
        return task.experimentalAssignment[user.experimentalGroup]; 
    }
    catch(e){
        console.log('getExperimentalCondition err',e);
    }
}

module.exports = getExperimentalCondition;