function ttu(){
  socket.emit('test-time-up');
}

function tu(){
  socket.emit('time-up');
}

const messageContainer = document.getElementById('message-container')
const roomContainer = document.getElementById('room-container')
const messageForm = document.getElementById('send-container')
const messageInput = document.getElementById('message-input')
const messagePreInput = document.getElementById('message-pre-input');
const {loadQuillOutput,processQuillInput,formatQuillText} = quillExtensions;
const icons = {
  teacher: '<b>Teacher: </b>',
  witness: `<i class="far fa-eye" style="background-color:white;color:black;border-radius:7px 7px 7px 7px;"></i>`,
  detective: `<i class="fas fa-search" style="-webkit-transform: scaleX(-1);transform: scaleX(-1);background-color:white;color:black;border-radius:2px 2px 2px 2px;border:1px solid white;"></i>`
};

function lang(en,jp){
  return language=='en' ? en : jp;
}

function getIcon(data){
  let {role,userindex} = data;
  role = !role && userindex=='teacher' ? userindex : role;
  if(role=='teacher'){
    if(data.action && data.private){
      return '<b>Teacher (to you only): </b>'
    }
  }
  return icons[role] ? icons[role] : '';
}

///margin-right:10px;margin-left:-30px;
const whoseLine = {};
let roleName = '';


function loadText(textContent){
  return loadQuillOutput('outputQuill','output',textContent,showWordInfo);
}

socket.emit('?',{package:1});


socket.on('fix-userindex',data=>{
  const {userindex} = data;
  myindex = userindex;
});

let foundRoom = false;

socket.on('found-room',data=>{
  console.log('found-room',data);
  foundRoom = true;
  myindex = data.userindex;
  roleName = data.roleName;
  taskId = data.taskId;
//
  elem.as({
    style:{
      innerHTML:data.role == 'witness' ? `
        #question-container {
          min-height:5vh; 
        }
        #question-container p {
            padding-left:5px;
            padding-top:5px;
        }
      ` : `
          #question-container {
            min-height:10vh;
            
          }
          #question-container p {
              margin-left: 5%;
          }
      `
    } 
  }).to(document.body);


  loadText(data.text);

  whoseLine[myindex] = 'my-line';
  data.chat.forEach(line=>{
    appendMessage(line);
  });


  function submitOnEnter(e){
    if(e.key == 'Enter'){
      e.preventDefault();
      submitForm();
    }
  }

  function submitOnSubmit(e){

    e.preventDefault()
    submitForm();

  }


  if (messageForm != null) {
    //const name = prompt('What is your name?')
    //appendMessage('[You joined]')
    
    function submitForm(){
      
      const message = $(messagePreInput).text();
      const sendTo = $('#send-to-select').val();
      if(!message || !message.trim()){
        return;
      }
      //appendMessage(message,myindex)
      $(messagePreInput).attr('contenteditable',false);
      $('.highlighted-error-reference').removeClass('highlighted-error-reference');
      socket.emit('send-chat-message', {
        message,
        sendTo
      });

    }




    messagePreInput.removeEventListener('keydown',submitOnEnter);
    messagePreInput.addEventListener('keydown',submitOnEnter);



    messageForm.removeEventListener('submit',submitOnSubmit);
    messageForm.addEventListener('submit',submitOnSubmit);
  }



});

//  socket.emit('new-user');








socket.on('finding-rooms',ms=>{
  findingRooms = true;
  const endDate = Date.now() + ms;
  showMessage([
    'div',
    {
      p:{
        text:`Loading game... Please wait <span></span> seconds.`,
        callback:function(el){
          function showSecondsLeft(){
            const secondsLeft = (endDate-Date.now())/1000;
            if(secondsLeft < 0 || foundRoom){
              closeMessage();
              return;
            }
            $(el).find('span').html(Math.round(secondsLeft));
            setTimeout(showSecondsLeft,30);
          }
          showSecondsLeft();
        }
      }
    }
  ],function(){
    return false;
  });
});

socket.on('change-room',()=>{
  console.log('change-room reload?');
  window.location.reload();
});

socket.on('room-created', room => {
  const roomElement = document.createElement('div')
  roomElement.innerText = room
  const roomLink = document.createElement('a')
  roomLink.href = `/${room}`
  roomLink.innerText = 'join'
  roomContainer.append(roomElement)
  roomContainer.append(roomLink)
});

function formatMessageQuill(){
  const contents = processQuillInput({ops:[{insert:$(messagePreInput).text()}]});
  //contents.ops.reverse();
  messageQuill = new Quill('#message-pre-input', {
      theme: 'snow',
      modules: {
          toolbar: false
      }
  });
  formatQuillText(messageQuill,contents);
  return true;
}

function highlightMessageErrorByIndex(from,to){
  $(messageQuill.container).find('.w').each(function(){
    const index = parseFloat($(this).data('index'));
    if(index < from || index > to){
      return true;
    }
    $(this).addClass('highlighted-error');
  });

}

function highlightMessageErrorByWord(word){
  $(messageQuill.container).find('.w').each(function(){
    const thisWord = this.innerHTML;
    if(thisWord != word){
      return true;
    }
    $(this).addClass('highlighted-error');
  });
}

function showHideClassOnClick(el,className){
  $(el).toggleClass('active');
  $(`.${className}`).toggle();
}

class MessageErrors{
  constructor(){
    return this;
  }
  wordWords(wordArray){
    return wordArray.length==1 ? 'word' : 'words';
  }
  charChars(charArray){
    return charArray.length==1 ? 'character' : 'characters';
  }
  isAre(wordArray){
    return wordArray.length==1 ? 'is' : 'are';
  }
  itThey(wordArray){
    return wordArray.length==1 ? 'it' : 'they';
  }
  genMessage(wordArray,status,reason=false,subject="wordWords"){
    const that = this;
    subject = that[subject] ? that[subject](wordArray) : '';
    const itThey = this.itThey(wordArray);
    const isAre = this.isAre(wordArray);
    const openSpan = '<span class="highlighted-error">';
    const closeSpan = '</span>';
    wordArray = wordArray.length==1 ? `${openSpan}${wordArray[0]}${closeSpan}` : `${openSpan}${[wordArray.slice(0,-1)].join(`${closeSpan}, ${openSpan}`)}${closeSpan}${wordArray.length > 2 ? ',' : ''}${lang(' and ',',')}${openSpan}${wordArray.slice(-1)[0]}${closeSpan}`;
    return lang(
      `The ${subject} ${wordArray} ${isAre} ${status}` + (!reason ? '' : ` because ${itThey} ${isAre} ${reason}`),
      `${wordArray}${status}`+(reason ? reason : '')
    );
  }
  formatMessageErrorMessage(feedback={}){
    const that = this;
    const {overlaps,wordErrors} = feedback;
    const messages = [];
    overlaps && messages.push({overlaps});
    if(wordErrors){
      const combinedWordErrors = Object.keys(wordErrors).reduce((errors,key)=>{
        const errorType = wordErrors[key];
        errors[errorType] = errors[errorType] ? errors[errorType] : [];
        errors[errorType].push(key);
        return errors;
      },{});
      messages.push(...Object.keys(combinedWordErrors).map(key=>{return {[key]: combinedWordErrors[key]};}));
    }
    return messages.map(error=>{
      const key = Object.keys(error)[0];
      return that[key](error[key],feedback);
    });
  }
  showMessageErrorMessage(feedback,revisedMessage){
    const that = this;
    const messages = that.formatMessageErrorMessage(feedback);
    // !$('#messageQuill-copy').length && elem.as({
    //   div:{
    //     id:'messageQuill-copy',
    //     html: $('#messageQuill.ql-container').html(),
    //     style:{display:'none'}
    //   }
    // }).to(document.body);
    // data.error && $('#messageQuill-copy').html($('#messageQuill.ql-container').html());
    showMessage([
      'div',
      'h3>Notice',
      ...[{ul:{style:{textAlign:'left'}}},1,...messages.map(u=>`li>${u}`),-1],
      `p>${
        lang(
          'These have been replaced in your message with "___", so:',
          '赤くなっている部分は"___"で置き換えられて、相手に送られています。'
        )
      }`,

      `p>${$('#message-pre-input.ql-container p').html()}`,
      `p><i class="fas fa-arrow-right"></i> ${revisedMessage}`,
      {
        button:{
          text:'OK',
          onclick:closeMessage
        }
      }

    ]);
  }
  overlaps(overlaps,feedback){
    if(feedback.messageShort){
      return lang(
        `Your message is too similar to part of the text (the red part). HINT: Try making your message longer.`,
        `あなたのタイプした内容（赤くなっている部分）は文章のある部分に類似しすぎています。ヒント：タイプする内容を長くしてみましょう。`
      );
    }
    return lang(
      `Your message is too similar to part of the text (the red parts). Please use different words.`,
      `あなたのタイプした内容（赤くなっている部分）は文章のある部分に類似しすぎています。ヒント：別の表現に言い換えてみましょう`
    );
  
  }
  illegalWord(words,feedback){
    const keywordsTrans = lang('keywords','文章中の黄色でしるしのつけられている部分の単語');
    const keywords = `<span class="link" onclick="showHideClassOnClick(this,'illegalWordList')">${keywordsTrans}</span>`;
    const keywordList = `<span style="display:none" class="illegalWordList">(<i>
                          ${feedback.illegalWordList.join(', ')}
                        </i>)</span>`;
    return lang(
      this.genMessage(
        words,
        `not allowed for chatting about this question`,
        `among the ${keywords} 
        ${keywordList}
        used in this part of the text. 
        Please try using different words to express the same meaning.`
      ),
      this.genMessage(
        words,
        `という単語は、この部分にノートをとる際には、使えません。${keywords}${keywordList}は別の表現に言い換えてみましょう。`
      )
    );
  }
  offList(words){
    return lang(
      this.genMessage(
        words,
        `not allowed for chatting about this text.`,
        `not included in this program's list of English words that can be used to chat. 
        If you would like to suggest that the word(s) be added, please talk to your teacher.`
      ),
      this.genMessage(
        words,
        `という単語は使えません。`,
        `はこのプログラムで使っている辞書（list of English words)に含まれていません。`,
        `を辞書に含めてほしい場合は、後で教員に相談しましょう。`
      )

    );
  }
  hasNumber(words){
    return this.genMessage(
      words,
      lang(
          `not allowed because using numbers makes it too easy to find the answer without having to talk about the meaning of the text and its keywords. 
          Please chat about the meaning of the words and text to find the correct answer.`,
          `という単語は使えません。数字を使うと文章の内容や単語の意味について触れずに答えられてしまいます。文章やキーワードの意味についてノートをとり答えを見つけましょう。`
        )
      );
  }
  textLocator(words){
    return this.genMessage(
      words,
      lang(
        `not allowed because using such words makes it too easy to find the answer without having to talk about the meaning of the text and its keywords. 
        Please chat about the meaning of the text and keywords to find the correct answer.`,
        `という単語を使うと、文章の内容や単語の意味について触れずに答えを見つけられてしまうので使えません。文章やキーワードの意味について書きましょう。`
       )
    );
  }
  illegalChars(words){
    
    const charChars = [...new Set(words.join('').replace(/\w/).split(''))];
    return this.genMessage(
      charChars,
      lang(`not allowed in messages.`,`ラテンアルファベット以外は使えません。`),
      false,
      'charChars'
    );

  }
}
const messageErrors = new MessageErrors();



// if(inclusions.includes(lemma)){
//     return 'illegalWord';
// }
// if(exceptions.includes(lemma)){
//     return false;
// }

// if(hasNumber(string)){
//     return 'hasNumber';
// }
// if(offList(string)){
//     return 'offList';
// }
// if(['sentence','paragraph','word'].includes(lemma)){
//     return 'textLocator';

// };

function showError(originalMessage,error){
  const {feedback,revisedMessage} = error;
  formatMessageQuill();
 

  const {overlaps,wordErrors} = feedback;
  feedback.overlaps && highlightMessageErrorByIndex(overlaps[0].start,overlaps[0].end);
  feedback.overlaps && highlight(overlaps[1].start,overlaps[1].end,'highlighted-error-reference');
  feedback.overlaps && scrollToWord(overlaps[1].end,'highlighted-error-reference');
  feedback.wordErrors && Object.keys(wordErrors).forEach(key=>highlightMessageErrorByWord(key));
  
  messageErrors.showMessageErrorMessage(feedback,revisedMessage);
}



socket.on('chat-message', data => {

 
  myindex == data.userindex && $(messagePreInput).attr('contenteditable',true);
  data.error && myindex == data.userindex && showError(data.message,data.error);//showMessage(data.error.message);
  
  myindex == data.userindex && $(messagePreInput).html('');
  !data.error && appendMessage(data);
  data.alertMessage && alertMessage(data.alertMessage);
  const chatMessageEvent = new CustomEvent('chat-message',{detail:data});
  data.userindex == 'teacher' && $('#send-to-select-container').show();
  window.dispatchEvent(chatMessageEvent);
})






function whoseLineClass(userindex){
  if(typeof userindex != 'number'){
    return userindex;
  }
  if(!whoseLine[userindex]){
    whoseLine[userindex] = Object.keys(whoseLine).length == 1 ? 'partner-line' : 'partner-line-2';
  }
  return whoseLine[userindex];
  
}

function toProperCase(string){
  return string[0].toUpperCase()+string.slice(1);
}


function filterMessageByRoleName(message){
  if(!message){
    return message;
  }
  return (()=>{
    const youYou = message.match(roleName) ? 'You' : 'you';
    const thisRoleName = youYou == 'You' ? roleName : roleName.toLowerCase();
    if(!this.thisRoleName){
      return message;
    }
    if(thisRoleName.split(' ')[0]=='The'){
      const properName = toProperCase(thisRoleName.split(' ')[1])+' 1';
      return message.split(thisRoleName).join(youYou).split(properName).join(youYou);
    }
    if(thisRoleName.split(' ')[1]=='1'){
      return message.split(thisRoleName).join(youYou).split('The '+thisRoleName.toLowerCase()).join(youYou);
    }
    return message.split(thisRoleName).join(youYou);     
  })().replace(/ou has /g,'ou have ');
}
function scrollSmoothToBottom (div) {
  $(div).animate({
     scrollTop: div.scrollHeight - div.clientHeight
  }, 500);
}
function appendMessage(data) {
  //appendMessage(data.role,data.message,data.userindex,data.time);
  let {role,message,userindex,time} = data;
  userindex = !userindex && userindex!==0 ? 'narration' : userindex;
  message = userindex == 'narration' ? filterMessageByRoleName(message) : message;
  role = userindex == 'teacher' ? userindex : role;
  const timeElement = document.createElement('div');
  timeElement.className = whoseLineClass(userindex)+' time';
  timeElement.innerHTML = time;
  const toTeacher = data.sendTo=='teacher' ? '(to teacher only): ' : '';
  messageContainer.append(timeElement);
  const icon = getIcon(data);
  elem.as({
    div:{
      text:`<p>${icon}${toTeacher}${message}</p>`,
      className: whoseLineClass(userindex),
      callback:function(el){
        //el.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
        // setTimeout(function(){
          //const divs = document.querySelectorAll('#message-container div');
          //divs[divs.length-1].scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
          messageContainer.scrollTo({
            top: messageContainer.scrollHeight,
            left: 0,
            behavior: 'smooth'
          });
        // },1000);
      }
    }
  }).to(messageContainer);
  // setTimeout(function(){
  //   //$(messageContainer).find('div');
  //   //messageElement.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
  //   //scrollSmoothToBottom(messageContainer);
  //   //$(messageContainer).animate({ scrollTop: $(document).height() }, 500);
  //   divs = document.querySelectorAll('#message-container div');
  //   divs[divs.length-1].scrollIntoView({behavior:'smooth',block:'center',inline:'center'});

  // },0);
  
}


function tagGoogleImageForWord(word,prevRes=false,findImgTries=false){

  const cleanWord = word.replace(/\W/g,'');
  if($(`.google-image-for-${cleanWord}`).length){
    return;
  }
  if(!$(`.looked-up-image-for-${cleanWord}`).length){
    return;
  }

  const that = this;
  that.timeout && clearTimeout(that.timeout);
  if(prevRes!==false && $('.gsc-results-wrapper-overlay').html()==prevRes){
    that.timeout = setTimeout(function(){
      tagGoogleImageForWord(word,prevRes);
    },30);
    return;
  }
  if(findImgTries===false){
    $('div.gsc-tabHeader.gsc-tabhInactive.gsc-inline-block').trigger('click');
    that.timeout = setTimeout(function(){
      tagGoogleImageForWord(word,false,0);
    },30);
    return;
  }
  
  const maxImgCount = 30;
  let imgCount=0;
  const imgLen = $('.gsc-imageResult').find('img').length;


  if(!imgLen){
    that.timeout = setTimeout(function(){
      tagGoogleImageForWord(word,false,0);
    },30);
    return;
  }

  if(findImgTries<5 && imgLen<maxImgCount){
    that.timeout = setTimeout(function(){
      findImgTries++;
      tagGoogleImageForWord(word,false,findImgTries);
    },30);
    return;
  }
  $('.gsc-imageResult').find('img').each(function(){
    const img = $(this).detach();
    $(img).addClass(`google-image`);
    $(img).addClass(`google-image-for-${cleanWord}`);
    $('#google-images').append(img);
    imgCount++;
    if(imgCount>=maxImgCount){

      $(img).remove();
    }
  });
}

function getGoogleImg(word){
  const prevRes = $('.gsc-results-wrapper-overlay').html();
  $('input#gsc-i-id1').val(`${word} clipart`);
  $('button.gsc-search-button.gsc-search-button-v2').trigger('click');
  tagGoogleImageForWord(word,prevRes);
}


function lookupWord(word,index,context=false){
  socket.emit('lookup-word',{word,index,context});
}
socket.on('lookup-word-result',wordInfo=>{
  const {word,translation,index,pos}=wordInfo;
  responsiveVoice.speak(word, "US English Female",{rate:.75});
  let el = '';
  $('.w').each(function(){
      if($(this).data('index')==index){
          el=this;
          return false;
      }
  });
  const imageHTML = '';
  
  showInSubWindow(el,[
    {
      div:{
        style:{
          width:'100%',
          textAlign:'center'
        }
      }
    },
      1,
        `h3>${word}`,
      -1,
    {
      table:{
        style:{
          margin:'0 auto',
          display:'table'
        }
      }
    },
    'tr',
    'td',
    {
      span:{
        text:'(finding images...)',
        style:{
          color:'gray'
        },
        className:`looked-up-image-for-${word.replace(/\W/g,'').toLowerCase()}`,
        id:'looked-up-images',
        callback:function(el){
          getGoogleImg(word.toLowerCase());
          function findImg(word){
            word = word.toLowerCase();
            const cleanWord = word.replace(/\W/g,'');
            if(!$(`.looked-up-image-for-${cleanWord}`).length){
              return;
            }
            if($(`img.google-image-for-${cleanWord}`).length){
              el.innerHTML = '';
              $(`img.google-image-for-${cleanWord}`).each(function(){
                //$(`img.google-image-for-congratulations`).length
                $(el).append(this.outerHTML);
                return false;
              });
              return;
            }
            setTimeout(function(){
              findImg(word);
            },30);
          }
          findImg(word);
        }
      }
    },
    {
      td:{
        text:translation.replace(/\n/g,'<br><br>'),
        style:{
          verticalAlign:'middle',
          minWidth:'150px'
        }
      }
    }
  ]);
});

$('.call-teacher').on('click',function(){
  showMessage([

    'div>Would you like to call your teacher?',
    {
      button:{
        text:`Yes, call my teacher now.`,
        onclick:function(e){
          closeMessage();
          showMessage([
            'div',
            'p>Would you like your call to be public (shared with your group) or private (just to you)?',
            {
              button:{
                text:'Public',
                onclick:function(){
                  closeMessage();
                  socket.emit('call-teacher');
                  timeoutMessage('Calling your teacher... Please wait a moment.');
                  $('#send-container').show();
                }
              }
            },
            {
              button:{
                text:'Private',
                onclick:function(){
                  closeMessage();
                  socket.emit('call-teacher','private');
                  timeoutMessage('Calling your teacher... Please wait a moment.');
                  $('#send-container').show();
                }
              }
            },
            {
              button:{
                text:'Cancel',
                onclick:function(){
                  closeMessage();
                }
              }
            }
          ]);
        }
      }
    },
    {
      button:{
        text:'Cancel',
        onclick:function(){
          closeMessage();
        }
      }
    }
  ]);
});


function inViewInTextContainer(el,partial=false){
  const elRect = el.getBoundingClientRect();
  const contRect = $('#text-container')[0].getBoundingClientRect();
  if(!partial){
    return elRect.top >= contRect.top && elRect.bottom <= contRect.bottom;
  }
  return elRect.top+(elRect.height/3) > contRect.top && elRect.bottom-(elRect.height/3) < contRect.bottom;
}

function getScrolledToText(){
  const text = [];
  $('#text-container').find('p').each(function(){
    const p = [];
    const that = this;
    $(that).find('a').each(function(){
      inViewInTextContainer(this,true) && p.push(this.innerHTML);
      
    });

    text.push(p.join(' '));
  });

  return text.join('\n\n').trim();
}

function logScrollWhenReady(e){
  // this.previousTimestamp = this.previousTimestamp ? this.previousTimestamp : 0;

  // this.previousTimestamp = e.originalEvent.timeStamp;
  const justProgrammaticallyScrolled = !!programmaticallyScrolled;
  this.logIfTimeOut && clearTimeout(this.logIfTimeOut);
  this.logIfTimeOut = setTimeout(function(){
    socket.emit('scrolled-text',{
      text:getScrolledToText(),
      who: justProgrammaticallyScrolled ? 'program' : 'user'
    });
    programmaticallyScrolled = false;
  },2000);
}
$('#text-container').on('scroll',function(e){
  logScrollWhenReady(e);
});


const htmlMessagePreviouslyEmitted = {};
socket.on('html-message',data=>{
  const {message,id} = data;
  $(`#${id}`).length && $(`#${id}`).html(message);
  htmlMessagePreviouslyEmitted[id]=true;
});


socket.on('html-message-once',data=>{
  const {message,id} = data;
  if(htmlMessagePreviouslyEmitted[id]){
    return;
  }

  $(`#${id}`).length && $(`#${id}`).html(message);
  htmlMessagePreviouslyEmitted[id]=true;
});

const alertedMessagePreviously = {};

socket.on('alert-message-once',message=>{
  if(alertedMessagePreviously[message]){
    return;
  }
  showMessage(message);
  alertedMessagePreviously[message]=true;
});

socket.on('cancel-message',args=>{
  cancelMessage(args);
});



socket.on('got-random-words',words=>{
  if(!$('#message-pre-input.ql-container').is(":visible")){
    return;
  }
  $('#message-pre-input.ql-container').html(words);
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
  
});





