const User = require('../models/User');
const Settings = require('../models/Settings');

async function addExperimentalSettingsForUser(user){
    try{
        const settings = await Settings.findOne({});
        user = await User.findOne({email:user.email});
        user.experimentalCondition = settings.experimentalAssignment[user.experimentalGroup];
        await user.save();
        return user;
    }
    catch(e){
        console.log('addExperimentalSettingsForUser err',e);
    }
}

module.exports = addExperimentalSettingsForUser;