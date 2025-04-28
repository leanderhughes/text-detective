

//socket.emit('find-room',username);

let raveText = '';

let raveWords = [];

function getRaveSentence(){
  const length = Math.round(Math.random()*(10 + 5)*7.5);
  const start = Math.round(Math.random()*(raveText.length-length));
  let string = raveText.slice(start,start+length);
  return string.slice(string.indexOf(' '),string.lastIndexOf(' '));
}

function getRaveWord(initialString){

  raveWords.sort(function(a,b){return Math.random()-.5;});
  for(let i=0,l=raveWords.length;i<l;i++){
    if(raveWords[i] && raveWords[i].indexOf(initialString)==0){
      const chunk = raveWords[i].replace(initialString,'');
      if(chunk){
        return chunk;
      }
      continue;
    }
  }
  return 'ummm';
  
}
let doTestFunctionsDone = false;
function doTestFunctions(){
  if(doTestFunctionsDone){
    console.log('doTestFunctionsDone already');
    return;
  }

    
if(isTestUser()){
    raveText = `
    On a typical day at school, endless hours are spent learning the answers to questions. But right now, we'll do the opposite. We're going to focus on questions where you can't learn the answers, because they're unknown. 
    I used to puzzle about a lot of things as a boy. For example, what would it feel like to be a dog? Do fish feel pain? How about insects? Was the Big Bang just an accident? And is there a God? And if so, how are we so sure that it's a He and not a She? Why do so may innocent people and animals suffer terrible things? Is there really a plan for my life? Is the future yet to be written, or is it already written and we just can't see it? But then, do I have free will? Who am I, anyway? Am I just a biological machine? But then, why am I conscious? What is consciousness? Will robots become conscious one day? 
    I mean, I kind of assumed that some day I would be told the answers to all these questions. I mean, someone must know, right? Huh. Guess what? No one knows.
    Most of those questions puzzle me more now than ever. But diving into them is exciting because it takes you to the edge of knowledge, and you never know what you'll find there. So, two questions to kick off this series, questions that no one on Earth knows the answer to... 
    
    "New drug may cure cancer." "Aspirin may reduce risk of heart attacks." "Eating breakfast can help you lose weight." 



Health headlines like these flood the news, often contradicting each other. So how can you figure out what’s a genuine health concern or a truly promising remedy, and what’s less conclusive? 



In medicine, there’s often a disconnect between news headlines and the scientific research they cover. That’s because a headline is designed to catch attention— it’s most effective when it makes a big claim. By contrast, many scientific studies produce meaningful results when they focus on a narrow, specific question. 



The best way to bridge this gap is to look at the original research behind a headline. We’ve come up with a simplified research scenario for each of these three headlines to test your skills. Keep watching for the explanation of the first study; then pause at the headline to figure out the flaw. Assume all the information you need to spot the flaw is included. 



Let’s start with this hypothetical scenario: a study using mice to test a new cancer drug. The study includes two groups of mice, one treated with the drug, the other with a placebo. At the end of the trial, the mice that receive the drug are cured, while those that received the placebo are not. 



Can you spot the problem with this headline: "Study shows new drug could cure cancer" 



Since the subjects of the study were mice, we can’t draw conclusions about human disease based on this research. In real life, early research on new drugs and therapies is not conducted on humans. If the early results are promising, clinical trials follow to determine if they hold up in humans. 



Now that you’ve warmed up, let’s try a trickier example: a study about the impact of aspirin on heart attack risk. The study randomly divides a pool of men into two groups. The members of one group take aspirin daily, while the others take a daily placebo. By the end of the trial, the control group suffered significantly more heart attacks than the group that took aspirin. 



Based on this situation, what’s wrong with the headline: "Aspirin may reduce risk of heart attacks" 



In this case, the study shows evidence that aspirin reduces heart attacks in men, because all the participants were men. But the conclusion “aspirin reduces risk of heart attacks” is too broad; we can’t assume that results found in men would also apply to women. Studies often limit participants based on geographic location, age, gender, or many other factors. Before these findings can be generalized, similar studies need to be run on other groups. If a headline makes a general claim, it should draw its evidence from a diverse body of research, not one study. 



Can you take your skills from the first two questions to the next level? Try this example about the impact of eating breakfast on weight loss. Researchers recruit a group of people who had always skipped breakfast and ask them to start eating breakfast everyday. The participants include men and women of a range of ages and backgrounds. Over a year-long period, participants lose an average of five pounds. 



So what’s wrong with the headline: "Eating breakfast can help you lose weight" 



The people in the study started eating breakfast and lost weight— but we don’t know that they lost weight because they started eating breakfast; perhaps having their weight tracked inspired them to change their eating habits in other ways. To rule out the possibility that some other factor caused weight loss, we would need to compare these participants to a group who didn’t eat breakfast before the study and continued to skip it during the study. A headline certainly shouldn’t claim the results of this research are generally applicable. And if the study itself made such a claim without a comparison group, then you should question its credibility. 



Now that you’ve battle-tested your skills on these hypothetical studies and headlines, you can test them on real-world news. Even when full papers aren’t available without a fee, you can often find summaries of experimental design and results in freely available abstracts, or even within the text of a news article. Individual studies have results that don’t necessarily correspond to a grabby headline. Big conclusions for human health issues require lots of evidence accumulated over time. But in the meantime, we can keep on top of the science, by reading past the headlines. 
    
    `;
    raveWords = [...new Set(raveText.replace(/\W{1,100}/g,' ').trim().split(' '))];

    function rave(){
      //console.log('rave off');
      //return;

      if(pauseTestUser){
        setTimeout(rave,10000);
        return;
      }
      
      const words = getRaveSentence();
      if($('#message-pre-input.ql-container').is(':visible')){
        $('#message-pre-input.ql-container').html(words);
      }
      
      if($('#finish-note').is(':visible')){
        $('#finish-note').trigger('click');
        setTimeout(function(){
          if($('#finished-note-confirmation-button').length){
            $('#finished-note-confirmation-button').trigger('click');
          }
    
        },Math.random() * 1000 + 500)
      }
      if($('#send-button').is(':visible')){
        $('#send-button').trigger('click');
      }
      //!pauseTestUser && $('#send-container').is(':visible') && socket.emit('get-random-words');
      setTimeout(rave,10000);
    }
    rave();

  
    function scrollRandomly(){

      if(pauseTestUser){
        setTimeout(scrollRandomly,Math.random()*10000);
        return;
      }
      if(location.href.indexOf('observe')>-1){
        return false;
      }
      if(!pauseTestUser && $('#text-container').find('a').is(':visible')){
        const anA = Math.round(($('#text-container').find('a').length-1)*Math.random());
    
        $('#text-container').find('a').each(function(index){
          if(index==anA){
            this.scrollIntoView({behavior: "smooth",block:'center'});
            return false;
          }
        }); 
      }
      setTimeout(scrollRandomly,Math.random()*10000);
    }
  
    scrollRandomly();
  
  }
  console.log('doTestFunctions');
  doTestFunctionsDone = true;
}

let checkHubUntillNextStageShown = '';
function checkUntillNextStageShownFunc(){

    checkHubUntillNextStageShown && clearTimeout(checkHubUntillNextStageShown);
    socket.emit('check-hub');
    checkHubUntillNextStageShown = setTimeout(checkUntillNextStageShownFunc,1000+2000*Math.random());
}

let prevHtml = '';

function checkAgainIfNoChange(){
    const currentHtml = $('#content').html();
    if(currentHtml!=prevHtml){

        socket.emit('check-hub');
        //return;
    }
    !doTestFunctionsDone && setTimeout(doTestFunctions,4000+3000*Math.random());
}

let lastPing = new Date().getTime();
let completedTask = false;

socket.onAny(()=>{
  lastPing = new Date().getTime();
  if($('.loading-message').length){
    closeMessage();
  }
});

function showLoadingMessage(msg="Loading... Please wait a bit."){
  if($('#message').length){
    return;
  }
  showMessage([
    'div.loading-message',
    `p>${msg}`
  ],function(){return false;});
}


function pingHub(){
  console.log('not pinging hub...');
  return;
  const pingTime = 15*1000;
  if(!currentStage){
    setTimeout(pingHub,pingTime);
    return;
  }
  if(new Date().getTime()-lastPing < pingTime){
    setTimeout(pingHub,pingTime);
    return;
  }
  if(completedTask){
    console.log('stopped pinging because complete');
    return;
  }
  socket.emit('ping-hub');
  lastPing = new Date().getTime();
  setTimeout(pingHub,pingTime);
}


socket.on('connected-user',()=>{
    // if(location.href.indexOf('tasks/')==-1 || !location.href.indexOf('tasks/').split('tasks/')[1].length){

    //   return;
    // }
    if(location.href.indexOf('chat/room')==-1){

      return;
    }
    
    pingHub();
    
    //prevHtml = $('#content').html();
    //setTimeout(checkAgainIfNoChange,3000);
    // checkUntillNextStageShownFunc();
    //setTimeout(doTestFunctions,4000+3000*Math.random());

});






socket.on('check-hub',()=>{
    console.log('check-hub');
    socket.emit('check-hub');
    !doTestFunctionsDone && setTimeout(doTestFunctions,4000+3000*Math.random());
});

const emittedOnlyOnce = {
    'start-question-response':true
}

const emitCount = {
    'start-question-response':0
}
const loadingMessage = {
  'check-hub':'Loading...',
  'find-room':'Loading... Please wait.',
  'start-pretest':'Loading Pre-Test... Please wait a moment.',
  'start-posttest':'Loading Post-Test... Please wait a moment.'
};


socket.on('emit',event=>{
    let data = false;
    if(event.event){
        data = event.data;
        event = event.event;
    }
    if(emitCount[event] && emittedOnlyOnce[event]){
        console.log(event,'can only be emitted once...');
        return;
    }
    console.log('emitting',event,data);
    
    data ? socket.emit(event,data) : socket.emit(event);
    emitCount[event] = emitCount[event] ? emitCount[event] : 0;
    emitCount[event]++;
    //loadingMessage[event] && showLoadingMessage(loadingMessage[event]);

});



let currentStage = '';

socket.on('show-stage',stageId=>{
    
   // checkHubUntillNextStageShown && clearTimeout(checkHubUntillNextStageShown);
    console.log('stageId',stageId);
    currentStage = stageId;
    $('.sequence').hide();

    //$(`#${stageId}`).show();
    $(`.${stageId}`).show();
});


socket.on('check-hub-until-next-stage-shown',()=>{

    checkHubUntillNextStageShown && clearTimeout(checkHubUntillNextStageShown);
    checkHubUntillNextStageShown = setTimeout(checkUntillNextStageShownFunc,3000);
});





// socket.on('hub-pinged',()=>{
//     console.log('pinged...');
//     lastPing = new Date().getTime();
// });

