const testMode = require('../custom_modules/test-mode');
const Task = require('../models/Task');
const Text = require('../models/Text');
const Room = require('../models/Room');
const User = require('../models/User');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const {lang,checkIfUserNotThere} = require('../custom_modules/user-room');



module.exports = function surveys(io,socket){

    socket.on('survey-socket-login',async(data)=>{
        try{
            const {token} = data;
            let user = await User.findOne({token});
            if(!user){
                //console.log('no user token found');
                //socket.emit('reload-surveys');
                
                return;
            }
            console.log('found token',user.token);
            user.token = '';
            user.socketId = socket.id;
            await user.save();
            socket.emit('survey-login-complete');

        }
        catch(e){
            console.log('e err',e);
        }
    });

    socket.on('save-survey',async(data)=>{
        try{

            const user = await User.findOne({socketId:socket.id});
            const creator = user.email;
            const {title,markUp,html,items,locked,published,overwrite} = data;
            if(!overwrite){
                const survey = await Survey.findOne({creator,title});
                if(survey){
                    socket.emit('survey-overwrite-request',data);
                    return;
                }
            }
            if(overwrite){
                const survey = await Survey.findOne({creator,title});
                if(survey){
                    await Survey.updateOne({creator,title},{markUp,html,items,locked,published});       
                }
                socket.emit('saved-survey',survey); 
                return;         
            }
            const survey = new Survey({creator,title,markUp,html,items,locked,published,overwrite});
            await survey.save();
            socket.emit('saved-survey',survey);
        }
        catch(e){
            console.log('e err',e);
        }
    });

    socket.on('get-surveys',async()=>{
        try{
            const user = await User.findOne({socketId:socket.id});
            if(!user){
                socket.emit('log-message',{msg:'failed to get surveys...',data});
                return;
            }
            const {isTeacher} = user;
            const surveys = await Survey.find({});
            for(let i=0,l=surveys.length;i<l;i++){
                const surveyResponse = await SurveyResponse.findOne({survey:surveys[i].id,username:user.email});
                surveys[i].complete = surveyResponse && surveyResponse.complete;
            }
            
            socket.emit('got-surveys',{
                isTeacher,
                surveys: isTeacher ? surveys : surveys.filter(s=>s.published).map(s=>{
                    const {id,title,complete} = s;
                    return {id,title,complete}
                }).reverse()
            })
        }
        catch(e){
            console.log('err e',e);
        }
    });

    socket.on('get-survey',async(data)=>{
        try{
            const user = await User.findOne({socketId:socket.id});
            if(!user){
                return;
            }
            const {isTeacher} = user; 
            const survey = await Survey.findOne(data);
            if(!survey){
                return;
            }
            const {id,title,markUp,html,items,locked,published} = survey;
            if(!user){
                return;
            }
            const currentResponses = await SurveyResponse.findOne({
                username:user.email,
                survey:id
            });
            if(currentResponses){
                socket.emit('got-survey',{
                    id:currentResponses.id,
                    survey:currentResponses.survey,
                    title,
                    markUp,
                    html,
                    items,
                    locked,
                    published,
                    responses:currentResponses.responses,
                    isTeacher,
                    complete:currentResponses.complete
                });
                return;
            }
            const newResponses = new SurveyResponse({
                username:user.email,
                survey:survey.id,
                title
            });
            await newResponses.save();
            const {responses,complete} = newResponses;
            socket.emit('got-survey',{
                id:newResponses.id,
                title,
                markUp,
                html,
                items,
                locked,
                published,
                responses,
                isTeacher,
                complete,
                survey:newResponses.survey
            });
        }
        catch(e){
            console.log('err e',e);
        }
    });

    socket.on('submit-response',async(data)=>{
        try{
            const {id,itemIndex,responseValue} = data;
            const surveyResponse = await SurveyResponse.findById(id);
            if(surveyResponse.complete){

                socket.emit('alert-message','You have already completed this survey, so your response cannot be changed.');
                return;
            }
            const survey = await Survey.findById(surveyResponse.survey);

            if(survey.locked){

                socket.emit('alert-message','Your response could not be saved, because this survey is locked. Please contact your teacher for assistance.');
                return;
            }
            const {responses} = surveyResponse;
            responses[itemIndex] = responseValue;
            surveyResponse.responses = responses;
            surveyResponse.markModified('responses');
            await surveyResponse.save();
        }
        catch(e){
            console.log('submit-response err',e);
        }
    });

    socket.on('survey-toggle-locked',async(data)=>{
        try{
            const {id,locked}=data;
            const survey = await Survey.findById(id);
            survey.locked = locked;
            await survey.save();
        }
        catch{

        }
    });

    socket.on('survey-toggle-published',async(data)=>{
        try{
            const {id,published}=data;
            const survey = await Survey.findById(id);
            survey.published = published;
            await survey.save();
        }
        catch(e){
            console.log('survey-toggle-published err',e);
        }
    });

    socket.on('submit-survey',async(data)=>{
        const {id}=data;
        const surveyResponse = await SurveyResponse.findById(id);
        surveyResponse.complete = true;
        await surveyResponse.save();
        socket.emit('survey-complete');
    });


    socket.on('get-survey-data',async()=>{
        try{
            const data = await SurveyResponse.find();
            socket.emit('got-survey-data',data);

        }
        catch(e){
            console.log('get-survey-data err');
        }
    });

    return socket;
}

