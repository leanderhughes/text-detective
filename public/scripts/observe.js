//see observer.ejs

//const { parse } = require("dotenv");



const currentRoles = {};
    
function toggleText(el){

  if($(el).hasClass('expanded')){
    $(el).removeClass('expanded')
    $(el).find('.expandable').hide();
    $(el).find('.ellipsis').show();
    return;
  }
  $(el).addClass('expanded');
  $(el).find('.expandable').show();
  $(el).find('.ellipsis').hide();
}

// setTimeout(function(){

  

  console.log('observe ready');

  function getMessageSection(msg,firstWordIndex,lastWordIndex){
    const beginnings = [...msg.matchAll(/\b\w/g)].map(m=>m.index);
    const ends = [...msg.matchAll(/\w\b/g)].map(m=>m.index);
    const beginning = beginnings[firstWordIndex-1];
    const end = ends[lastWordIndex-1];
    return msg.slice(beginning,end+1);
  }



  function textToExpandableSnippet(text){
    const snippetLength = 6;
    text = text.split(' ');
    if(text.length < snippetLength+4){
      return text.join(' ');
    }
    const start = Math.round(text.length/2)-snippetLength/2;
    const end = Math.round(text.length/2)+snippetLength/2;
    const sections = [text.slice(0,start),text.slice(start,end),text.slice(end)].map(t=>t.join(' '));
    return `
        <span onclick="toggleText(this)">
          <span class="expandable" style="display:none">${sections[0]}</span>
          <span class="ellipsis">...</span>${sections[1]}<span class="ellipsis">...</span>
          <span class="expandable" style="display:none">${sections[0]}</span>
        </span>`
  }


  function formatActionMessage(line){
    const {action,message} = line;
    if(action=='callTeacher'){
      return `<span class="called-teacher">${message}</span>`;
    }
    if(!['userScroll','programScroll'].includes(line.action)){
      return `<em>${message}<em>`;
    }
    const scrolledOrShown = action=='userScroll' ? 'Scrolled to' : 'Shown';
    return `<em>${scrolledOrShown}: ${localStorage.getItem('showFullScroll') ? line.text : textToExpandableSnippet(line.text)}</em>`;
  }

  function convertErrorInfo(line){
    if(!line.error){
      return '';
    }
    let errorInfo = '';
    const erOb = {};
    const errorLabels = {
      offList:'Unknown Word',
      illegalWord:'Illegal Keyword',
      illegalChars:'Illegal Character',
      overlaps:'Message Overlap'
    };
    if(line.error.feedback.wordErrors){
      const {wordErrors,overlaps} = line.error.feedback;
      // Object.values(overlaps).forEach(e=>{
      //   erOb[e] = [];
      // });
      // Object.keys(overlaps).forEach(k=>{
      //   const val = overlaps[k];
      //   erOb[val].push(k);
      // });
      if(overlaps){
        const {start,end} = overlaps[0];
        erOb.overlaps = [getMessageSection(line.message,start,end)];
      }
      Object.values(wordErrors).forEach(e=>{
        erOb[e] = [];
      });
      Object.keys(wordErrors).forEach(k=>{
        const val = wordErrors[k];
        erOb[val].push(k);
      });       
      errorInfo = errorInfo + Object.keys(erOb).map(k=>{
        const plural = erOb[k].length > 1 ? 's' : '';
        return `<span class="error-info"><i>${errorLabels[k]}${plural}</i></span>: <i>${erOb[k].join(', ')}</i>`
      }).join('; ');
    }
    const errorPlural = Object.keys(erOb).length>1 ? 's' : '';
    return errorInfo ? ` <span class="error-info">Error${errorPlural}:</span> [${errorInfo}]` : '';
  }
  function proper(string){
    return !string ? string : string.slice(0,1).toUpperCase()+string.slice(1);
  }
  function authorLabel(userindex,role='',errorInfo=false){
      if(typeof userindex=='string'){
          return '';//return `<b>${userindex}</b>`;
      }
      const blockedAttemptBy = errorInfo ? 'Blocked attempt by ' : '';
      if(!role){
          return `<span class="error-info">${blockedAttemptBy}</span>`+'<b>'+['A: ','B: ','C: '][userindex]+'</b>';
      }        
      return `<span class="error-info">${blockedAttemptBy}</span>`+'<b>'+['A (','B (','C ('][userindex]+proper(role)+'): '+'</b>';
  }
  function formatChatLine(c,i,indexToUsername){
    const username = indexToUsername[c.userindex] ? indexToUsername[c.userindex] : c.userindex;
    const role = c.role !== currentRoles[username] ? c.role : '';
    currentRoles[username] = c.role;
    if(c.sendTo && c.sendTo=='teacher'){
      return  `p.line line_${i}><b>${['A','B','C'][c.userindex]} (to teacher only):</b> ${c.message} (${c.time})`;
    }
    if(c.userindex=='teacher'){
      const fromTeacher = `<span class="from-teacher">Teacher</span>`;
      if(c.private){
        const toWhom = ['A','B','C'][parseFloat(c.sendTo)];
        return  `p.line line_${i}><b>${fromTeacher} (to ${toWhom}):</b> ${c.message} (${c.time})`;
      }
      return  `p.line line_${i}><b>${fromTeacher}:</b> ${c.message} (${c.time})`;
    }
    if(c.userindex=='narration'){
      return `p.line line_${i}><i>${c.message} (${c.time})</i>`;
    }

    const errorInfo = convertErrorInfo(c);
    const finalMessage = c.action ? `<span class="action-info">${formatActionMessage(c)} (${c.time})</span>` : `${c.message}  (${c.time})`;
    if(!c.error && !c.action && typeof c.userindex != 'string'){
      return `p.line actualMessage line_${i}><b>${authorLabel(c.userindex,role,errorInfo)}${finalMessage}${errorInfo}</b>`;
    }
    return `p.line line_${i}>${authorLabel(c.userindex,role,errorInfo)}${finalMessage}${errorInfo}`;
  }

  socket.on('connected-user',()=>{
    socket.emit('start-observation',{username});
  });

  socket.on('restart-observation',()=>{
    socket.emit('start-observation',{username});
  });

  function callCheck(silent=false){
    let unansweredCall = '';
    $('.chat-box').each(function(){
      const chatBox = this;
      let called = false;
      let answered = false;
      $(chatBox).find('.line').each(function(){
        if($(this).find('.called-teacher').length){
          called = true;
          answered = false;
        }
        if($(this).find('.from-teacher').length){
          answered = true;
        }
      });
      if(called && !answered){
        $(chatBox).addClass('unanswered-call-from-this-room');
        unansweredCall = chatBox;
      }
      else{
        $(chatBox).removeClass('unanswered-call-from-this-room');
      }

    });
    !silent && unansweredCall && showMessage("You have an unanswered call.",function(){
      unansweredCall.scrollIntoView({behavior:'smooth',block:'center'});
    });
  }

  const roomIdToRoomNumber = {};
  const roomNumberToRoomId = {};
  let task = '';

  function gs(usernames=false){
    if(!task){
      console.log('cannot get stats -> no task...');
      return;
    }
    const search = {task};
    if(usernames){
      search.usernames = usernames
    }
    socket.emit('get-observation-stats',search);
  }

  const newRoomUsers = [];

  let taskTitle = '';

  socket.on('started-observation',data=>{
      const {text,title,socketId,rooms} = data;
      task = data.task;
      taskTitle = title;
      console.log({socketId,title,text,task,rooms});

      loadText(text);
      $('#task').show();
      $('#message-container,#send-container,#send-button,#question-container').hide();
      $('#task').append(elem.as({
          button:{
              text:'<i class="far fa-window-maximize"></i>',
              onclick:function(){
                  $('#text-container').css('max-height')!='none' ? $('#text-container').css('max-height','none') : $('#text-container').css('max-height','40px');
              }
          }
      }));

      let roomCount = 1;
      for(let i=0,l=rooms.length;i<l;i++){
        rooms[i].indexToUsername = rooms[i].users.reduce((ob,u)=>{
            ob[u.userindex] = u.username;
            return ob;
          },{});
      }

      let callCheckTimeout = setTimeout(callCheck,1000);
      rooms.forEach(room=>{
          const {_id,users,chat,indexToUsername,experimentalCondition} = room;
          roomIdToRoomNumber[_id] = roomCount;
          roomNumberToRoomId[roomCount] = _id;
          const roomNumber = roomCount;
          const roomId = _id;
          function send(){
            console.log(`#teacher-message-input-${roomNumber}`);
            const messageEl = $(`#teacher-message-input-${roomNumber}`)[0];
            if(!messageEl || !messageEl.innerText || !messageEl.innerText.trim()){
              console.log('messageEl',messageEl);
              showMessage("Text is required for messages to be sent.");
              return;
            }
            messageEl.contentEditable = false;
            socket.emit('send-teacher-message',{
              roomId,
              roomNumber,
              message: messageEl.innerText.trim(),
              sendTo:$(`#send-to-${roomNumber}`).val()
            });
          }
          function getSendOptions(users){
            return users.reduce((options,u)=>{
              options.push({
                option:{
                  text:['A','B','B'][u.userindex]+` (${u.username})`,
                  value:u.userindex
                }
              });
              return options;
            },[{
              option:{
                text:'Room',
                value:'room'
              }
            }]);
          }
          const roomEls = [
              'div.room',
              `h3>Room ${roomCount}: ${experimentalCondition}`,
              `p><b>Users:</b><br> ${users.map(u=>authorLabel(u.userindex)+'<span class="change-room username" data-room="'+roomId+'">'+u.username+'</span><span id="stats_'+u.username.replace(/@/g,'AT').replace(/\./g,'DOT')+'"></span>').join(', <br>')}<br> <span id="room-stats_${roomCount}"></span>`,
              `div#room_${roomCount}.chat-box`,
                1,
                  ...room.chat.map((c,i)=>{
                    return formatChatLine(c,i,indexToUsername);
                  }),
                -1,
              {
                div:{
                  className:'teacher-message-input',
                  id:`teacher-message-input-${roomCount}`,
                  contentEditable:true,
                  innerHTML:'<span class="before-typing">(My message)</span>',
                  style:{
                    border:'1px solid gray',
                    padding: '4px 4px 4px 4px'
                  },
                  onfocus:function(){
                    $(this).find('.before-typing').remove();
                  },
                  onkeydown:function(e){
                    if(e.key=='Enter'){
                      send();
                    }
                  },
                  callback:function(){
                    clearTimeout(callCheckTimeout);
                    callCheckTimeout = setTimeout(callCheck,1000);
                  }
                }
              },

              'div',
                1,
                  {
                    button:{
                      text:'Send',
                      onclick:send
                    }
                  },
                  `select#send-to-${roomNumber}> to `,
                    1,
                    ...getSendOptions(users)
          ];
          console.log({roomEls});
          $('#rooms').append(elem.as(roomEls));
          roomCount++;
      });
      $('.change-room').on('click',function(){
        const username = $(this).html();
        const oldRoom = this.dataset.room;
        const inputId = 'new-room-for-'+username.replace(/@/g,'AT').replace(/\./g,'DOT');
        showMessage([
          `p>Change room for ${username}?`,
          {
            input:{
              
              type:'number',
              id:inputId
            }
          },
          {
            button:{
              innerHTML:'change',
              onclick:function(){
                const newRoomNumber = parseFloat($(`#${inputId}`).val());
                !newRoomUsers.includes(username) && newRoomUsers.push(username);
                console.log({newRoomNumber});
                console.log(roomNumberToRoomId[newRoomNumber]);
                console.log('change-room',{
                  username,
                  newRoom: roomNumberToRoomId[newRoomNumber] ? roomNumberToRoomId[newRoomNumber] : false,
                  oldRoom
                });
                socket.emit('change-room',{
                  username,
                  newRoom: roomNumberToRoomId[newRoomNumber] ? roomNumberToRoomId[newRoomNumber] : false,
                  oldRoom
                });
              }
            }
          },
          {
            button:{
              innerHTML:'Finalize',
              onclick:function(){
                socket.emit('finalize-new-rooms',{
                  usernames:newRoomUsers
                });
                setTimeout(function(){
                  location.reload();
                },500);
              }
            }
          }
        ]);
      });

      const allUsers = [];
      console.log('rooms',rooms);
      rooms.forEach(r=>{
        r.room = r._id;
        addProfData(r);
        reportRoomProgress(r);
        allUsers.push(...r.users.map(u=>u.username));
      });
      console.log('query for gtp',{
        users:allUsers,
        task
      });
      socket.emit('get-test-progress-for-all-users',{
        users:allUsers,
        task
      });
      socket.emit('get-names-of-users',{users:allUsers});
      socket.emit('get-task-titles-for-class');

  });

  socket.on('got-names-of-users',data=>{
    console.log('got-names-of-users',data);
    const {users} = data;
    const userOb = users.reduce((ob,u)=>{
      ob[u.username] = u;
      return ob;
    },{});
    $('.username').each(function(){
      const username = $(this).html();
      if(userOb[username]){
        const {sid} = userOb[username];
        sid && $(this).html(sid);
      }
      // if(userOb[username]){
      //   // const {personalName,familyName} = userOb[username];
      //   // const fullname = personalName || familyName ? `${personalName} ${familyName}` : `?${username}`;
      
      //   //$(this).html(fullname);

      //   //$(this).html(this.innerHTML.split('@')[0]);
      // }
    });
  });

  function handleTeacherCall(line,roomNumber){
    const roomId = roomNumberToRoomId[roomNumber];
    const {userindex,private} = line;
    showMessage([
      `div>A ${line.role} (${line.username}) in Room ${roomNumber} is calling you${private ? ' (privately)' : ''}.`,
      {
        button:{
          text:'Respond now.',
          onclick:function(){
           scrollIntoView($(`#teacher-message-input-${roomNumber}`)[0]);
            $(`#teacher-message-input-${roomNumber}`).focus();
            $(`#send-to-${roomNumber}`)[0].value = private ? userindex : 'room';
            socket.emit('teacher-responding-now',{
              roomId,
              userindex,
              username
            });
            closeMessage();
          }
        }
      },
      {
        button:{
          text:'Respond later.',
          onclick:function(){
            $(`#send-to-${roomNumber}`)[0].value = private ? userindex : 'room';
            $(`#room_${roomNumber}`).addClass('unanswered-call-from-this-room');
            socket.emit('teacher-responding-later',{
              roomId,
              userindex,
              username
            });
            closeMessage();
          }
        }
      }
    ]);
  }

  socket.on('update-chat',data=>{

    const {room,from,lines,indexToUsername} = data;
    const roomNumber = roomIdToRoomNumber[room];
    const roomDiv = $(`#room_${roomNumber}`)[0];
    lines.forEach((line,index)=>{
      const i = index + from;
      if($(roomDiv).find(`.line_${i}`).length){

        return;
      } 
      line.username = indexToUsername[line.userindex] ? indexToUsername[line.userindex] : '';
      const chatLine = elem.as(formatChatLine(line,i,indexToUsername));
      line.action=='callTeacher' && handleTeacherCall(line,roomNumber);
      $(roomDiv).append(chatLine);
      //chatLine.scrollIntoView();
      $(chatLine).addClass('highlighted');
      setTimeout(function(){
        $(chatLine).removeClass('highlighted');
        callCheck('silent');
      },2000);
    });
  });

  socket.on('sent-teacher-message',data=>{
    $('#teacher-message-input-'+data.roomNumber).html(' ');
    $('#teacher-message-input-'+data.roomNumber)[0].contentEditable=true;


  });



  socket.on('got-observation-stats',data=>{
    const {stats} = data;
    
    console.log('got-observation-stats',data);
    stats.forEach(s=>{
      const {rawProfScores,username} = s;
      if(!rawProfScores){
        return;
      }
      const {pretest,posttest} = rawProfScores;
      const {taskPoints,pointsPossible,room} = s;
      const statString = ` (${pretest===undefined ? '?' : pretest} - ${posttest===undefined ? '?' : posttest})`;
      const statsId = `#stats_${username.replace(/@/g,'AT').replace(/\./g,'DOT')}`;
      $(statsId).html(statString);
      $(statsId).addClass('highlighted');
      const roomId = `#room-stats_${roomIdToRoomNumber[room]}`;
      if(pointsPossible!==undefined){
        $(roomId).html(`${taskPoints===undefined ? '?' : taskPoints}/${pointsPossible===undefined ? '?' : pointsPossible}`);
        $(roomId).addClass('highlighted');
      }
      setTimeout(function(){
        $(statsId).removeClass('highlighted');
        pointsPossible!==undefined && $(roomId).removeClass('highlighted');
        callCheck('silent');
      },2000);

    });
  });

  // socket.on('update-observation-stats',data=>{
  //   console.log('get-observation-stats',data);
  //   socket.emit('get-observation-stats',data);
  // });

  const testStats = {};

  function addTestReportToStats(data){
    const {username,stage,inputIndex,totalPoints} = data;
    testStats[username] = testStats[username] ? testStats[username] : {};
    testStats[username][stage] = testStats[username][stage] ? testStats[username][stage] : {};
    testStats[username][stage].inputIndex = inputIndex;
    testStats[username][stage].totalPoints = totalPoints;
    if(data.complete){
      testStats[username][stage].inputIndex = 'C';
    }
    if(data.timeUp){
      testStats[username][stage].inputIndex = 'T';
    }


  }

  function getTestStat(username,stage,prop){
    return testStats[username] && testStats[username][stage] && testStats[username][stage][prop] ? testStats[username][stage][prop] : '_';
  }

  function reportTestProgress(data){
    const {username,stage,totalPoints,inputIndex,complete,timeUp}= data;
    addTestReportToStats(data);
    const preIndex = getTestStat(username,'pretest','inputIndex');
    const preScore = getTestStat(username,'pretest','totalPoints');
    const postIndex = getTestStat(username,'posttest','inputIndex');
    const postScore = getTestStat(username,'posttest','totalPoints');
    const statString = ` ${preIndex} (${preScore}) - ${postIndex} (${postScore})`; ///` (${pretest===undefined ? '?' : pretest} - ${posttest===undefined ? '?' : posttest})`;
    
    
    const statsId = `#stats_${username.replace(/@/g,'AT').replace(/\./g,'DOT')}`;
    $(statsId).html(statString);
    $(statsId).addClass('highlighted');
    setTimeout(function(){
      $(statsId).removeClass('highlighted');
    },2000);
  }

  // socket.on('report-test-progress',data=>{

  //   reportTestProgress(data);
  // });

  socket.on('got-test-progress-for-all-users',data=>{
    console.log('got-test-progress-for-all-users',data);
    const {profRows} = data;
    profRows.forEach(p=>reportTestProgress(p));
  });

  function reportRoomProgress(data){

    const neededKeys = {      
      room:1,
      currentQuestionIndex:1,
      currentPoints:1,
      pointsPossible:1,
      task:1
    };
    for(let key in neededKeys){
      if(!data[key] && data[key]!==0){
        data[key] = '';
      }
    }
    const {
      room,
      currentQuestionIndex,
      currentPoints,
      pointsPossible,
      task
    } = data;
    const roomId = `#room-stats_${roomIdToRoomNumber[room]}`;

    $(roomId).html(`${currentQuestionIndex} (${currentPoints}/${pointsPossible})`);
    $(roomId).addClass('highlighted');

    setTimeout(function(){
      $(roomId).removeClass('highlighted');
      callCheck('silent');
    },2000);
  }
  
  

  function listSelectTitleOptions(titles,stage){
    const ts = titles;
    ts.unshift({_td:'',title:' '});
    return ts.map(t=>{
      return {
        option:{
          innerHTML:t.title,
          className:stage,
          value:t._id

        }
      }
    });
  }

  const taskIdToTitle = {};

  socket.on('got-task-titles-for-class',data=>{

    console.log('got-task-titles-for-class',data);

    const {titles} = data;

    titles.forEach(t=>{
      taskIdToTitle[t._id] = t.title;
    });

    elem.as([
      'div',
      'table',
      'tr',
      'td>Pre',
      'td>Post',
      'tr',
      'td',
      {
        select:{
          className:'pretest',
          callback:function(el){
            $(el).on('change',function(){  
              console.log({
                task:this.value,
                stage:this.className
              });        
              this.value && socket.emit('get-proficiency-data-for-task-stage',{
                task:this.value,
                stage:this.className
              });
              this.value && socket.emit('get-all-proficiency-data-for-task-stage',{
                task:this.value,
                stage:this.className
              });
            });
          }
        }
      },
        1,
        ...listSelectTitleOptions(titles,'pretest'),
      'td',
      {
        select:{
          className:'posttest',
          callback:function(el){
            $(el).on('change',function(){
              currentPosttestTitle = taskIdToTitle[this.value];
              console.log({
                task:this.value,
                stage:this.className
              }); 
              this.value && socket.emit('get-proficiency-data-for-task-stage',{
                task:this.value,
                stage:this.className
              });
              this.value && socket.emit('get-all-proficiency-data-for-task-stage',{
                task:this.value,
                stage:this.className
              });
            });
          }
        }
      },
        1,
        ...listSelectTitleOptions(titles,'posttest'),
      'td',
      {
        button:{
          innerHTML:'download',
          onclick:function(){
            exportTableToCSV('profData',getDownloadTitle());
            showMessage('Downloaded.');
          }
        }
      }
  
    ]).to($('#content')[0]);



  });

  const profData = {};

  const roomNums = {};

  function getRoomNumber(task,_id){
    roomNums[task] = roomNums[task] ? roomNums[task] : {};
    roomNums[task][_id] = roomNums[task][_id] ? roomNums[task][_id] : Object.keys(roomNums[task]).length+1;
    return roomNums[task][_id];
  }


  function addRoomDataToProfData(data){
    const {_id,task,users,chat,currentPoints,messagePoints,pointsPossible,experimentalCondition,feedback} = data;
    const roomNumber = getRoomNumber(task,_id);
    const answerPoints = currentPoints - messagePoints;
    let groupChatCount = 0;
    let groupWordCount = 0;
    let afterFinished = false;
    for(let i=0,l=chat.length;i<l;i++){
      if(afterFinished){
        chat[i].deletedSeconds = chat[i].seconds;
        chat[i].deletedTime = chat[i].time;
        chat[i].time = '';
        chat[i].seconds = 0;
        
      }
      if(chat[i].userindex=='narration' && chat[i].message=='Congratulations! You have completed this activity!'){
        afterFinished = true;
      }
    }
    const secondsFromChatSeconds = chat.filter((c,i)=>i && c.seconds && !c.error).reduce((sum,c)=>{
      sum+=c.seconds;
      return sum;
    },0) / users.length;
    const firstTime = chat.find(c=>c.time).time;
    chat.reverse();
    const lastTime = chat.find(c=>c.time).time;
    chat.reverse();
    function parseMinTimeString(string){
      if(typeof string != 'string' || string.indexOf(':')==-1){
        console.log('parseMinTimeString',string,typeof string);
      }
      return parseFloat(string.split(':')[0])*3600 + parseFloat(string.split(':')[1])*60;
    }
    const timeDif = parseMinTimeString(lastTime) - parseMinTimeString(firstTime);
    const seconds = timeDif > secondsFromChatSeconds && timeDif < 40*60 ? timeDif : secondsFromChatSeconds;
    data.timeDif = timeDif;
    data.seconds = seconds;
    const groupWordLookup = chat.filter(c=>c.action == 'lookup').length;
    const groupScroll = chat.filter(c=>c.action == 'userScroll').length;
    const groupError = chat.filter(c=>c.error).length;
    users.forEach(u=>{
      const {username} = u;
      const userindex = users.find(u=>u.username==username).userindex;
      const chatLines = chat.filter(c=>!c.action && !c.error && c.userindex==userindex);
      const wordLookup = chat.filter(c=>c.action == 'lookup' && c.userindex==userindex).length;
      const scroll = chat.filter(c=>c.action == 'userScroll' && c.userindex==userindex).length;
      const error = chat.filter(c=>c.error && c.userindex==userindex).length;
      const chatCount = chatLines.length;
      const chatWordCount = chatLines.reduce((count,l)=>{
        if(!l){
          return count;
        }
        if(!l.message){
          return count;
        }
        l = l.message.replace(/[^a-zA-Z_]{1,100}/g,' ');
        l = l.trim();
        count+=l.split(' ').length;
        return count;
      },0);
      groupChatCount+=chatCount;
      groupWordCount+=chatWordCount;
      profData[username] = profData[username] ? profData[username] : {};
      profData[username].task = {
        chatCount,
        chatWordCount,
        scroll,
        wordLookup,
        error,
        seconds
      }
    });
    const groupSize = users.length;
    users.forEach(u=>{
      const {username} = u;
      const dataSet = {roomNumber,experimentalCondition,groupChatCount,groupWordCount,groupWordLookup,groupScroll,groupError,answerPoints,pointsPossible,messagePoints,groupSize};
      const userFeedback = feedback.find(f=>f.username==username);
      if(userFeedback){
        dataSet.feedback = userFeedback.feedback;
        dataSet.funInteresting = userFeedback.funInteresting;
        dataSet.improvedEnglish = userFeedback.improvedEnglish;
      }
      console.log('feedback',feedback);
      Object.keys(dataSet).forEach(p=>{
        profData[username].task[p] = dataSet[p];
      });
      
    });
  }

  function addProfData(data){
    if(data && data.users){
      addRoomDataToProfData(data);
      return;
    }
    const {profRows} = data;
    if(!profRows || !profRows.length){
      return;
    }
    profRows.forEach(p=>{
      const {username,personalName,familyName,sid,stage,totalPoints,totalPointsPossible,cPoints,cPointsPossible,transPoints,transPointsPossible,complete,timeUp,createdAt,missing} = p;
      const name = `${personalName} ${familyName}`;
      profData[username] = profData[username] ? profData[username] : {};
      profData[username][stage] = {
        username,
        personalName,
        familyName,
        name,
        sid,
        createdAt,
        totalPoints,
        totalPointsPossible,
        cPoints,
        cPointsPossible,
        transPoints,
        transPointsPossible,
        complete,
        timeUp,
        missing
      };
      const pretestPoints = getProfDatum(username,'pretest','totalPoints');
      const posttestPoints = getProfDatum(username,'pretest','totalPoints');
      if(!isNaN(pretestPoints) && !isNaN(posttestPoints)){
        profData[username].change = posttestPoints - pretestPoints;
      }
      else{
        profData[username].change = 'n/a';
      }
    });

  }

  function getProfDatum(username='',stage,prop){
    if(!username){
      if(prop.match(/points/i) && !prop.match(/possible/i)){
        console.log('match points');
        const propPoss = prop+'Possible';
        for(let user in profData){
          const val = getProfDatum(user,stage,propPoss);
          if(val!='n/a'){
            return `${prop}(${val})`;
          }

        }
      }
      return prop;
    }
    if(!profData[username] || !profData[username][stage] || profData[username][stage].missing){
      return 'n/a';
    }
    if(prop=='change'){
      return profData[username][prop];
    }
    if(prop=='createdAt' || prop=='dateUpdated'){
      return new Date(profData[username][stage][prop]).toString().split(' ').slice(0,3).join(' ');
    }
    if(prop=='complete' || prop=='timeUp'){
      return profData[username][stage][prop] ? 1 : 0;
    }
    return profData[username][stage][prop]==undefined ? 'n/a' : profData[username][stage][prop];
  }
  let currentPostTest = '';
  function getDownloadTitle(){
    const experimentalConditionOb = {};
    for(let user in profData){
      const experimentalCondition = getProfDatum(user,'task','experimentalCondition');
      if(experimentalCondition=='n/a'){
        continue;
      }
      experimentalConditionOb[experimentalCondition] = 1;
    }
    const experimentalConditions = Object.keys(experimentalConditionOb);
    experimentalConditions.sort();
    let delayed = currentPosttestTitle ? currentPosttestTitle.replace(/[^2]/g,'') : '';
    delayed = delayed ? `_${delayed}` : delayed;
    return `${experimentalConditions.join('_v_')}__${taskTitle.slice(0,7).trim().replace(/\s/g,'_')}${delayed}.csv`;
  }

  function getProfRowPriority(username){
    let priority = 0;
    if(profData[username].pretest && !profData[username].pretest.missing){
      priority++;
    }
    if(profData[username].posttest && !profData[username].posttest.missing){
      priority++;
    }
    return priority;
  }

  function getProfDataRows(){
    const usernames = Object.keys(profData);
    usernames.sort((b,a)=>{
      return getProfRowPriority(a) - getProfRowPriority(b);
    })
    console.log('usernames',usernames);
    usernames.unshift('');

    return usernames.reduce((row,username)=>{
      row.push(...[
        'tr',
        `td>${getProfDatum(username,'pretest','username')}`,
        `td>${getProfDatum(username,'pretest','sid')}`,
        `td>${getProfDatum(username,'pretest','name')}`,
        `td>${getProfDatum(username,'task','experimentalCondition')}`,
        `td>${getProfDatum(username,'pretest','totalPoints')}`,
        `td>${getProfDatum(username,'posttest','totalPoints')}`,

        `td>${getProfDatum(username,'pretest','cPoints')}`,
        `td>${getProfDatum(username,'posttest','cPoints')}`,

        `td>${getProfDatum(username,'pretest','transPoints')}`,
        `td>${getProfDatum(username,'posttest','transPoints')}`,


        `td>${getProfDatum(username,'posttest','change')}`,
        `td>${getProfDatum(username,'task','answerPoints')}`,
        `td>${getProfDatum(username,'task','pointsPossible')}`,
        `td>${getProfDatum(username,'task','messagePoints')}`,
        `td>${getProfDatum(username,'task','chatCount')}`,
        `td>${getProfDatum(username,'task','chatWordCount')}`,
        `td>${getProfDatum(username,'task','groupChatCount')}`,
        `td>${getProfDatum(username,'task','groupWordCount')}`,

        `td>${getProfDatum(username,'task','seconds')}`,
        `td>${getProfDatum(username,'task','wordLookup')}`,
        `td>${getProfDatum(username,'task','groupWordLookup')}`,
        `td>${getProfDatum(username,'task','groupScroll')}`,
        `td>${getProfDatum(username,'task','scroll')}`,
        `td>${getProfDatum(username,'task','error')}`,
        `td>${getProfDatum(username,'task','groupError')}`,


        `td>${getProfDatum(username,'task','roomNumber')}`,
        `td>${getProfDatum(username,'pretest','complete')}`,
        `td>${getProfDatum(username,'posttest','complete')}`,
        `td>${getProfDatum(username,'pretest','timeUp')}`,
        `td>${getProfDatum(username,'posttest','timeUp')}`,
        `td>${getProfDatum(username,'pretest','createdAt')}`,
        `td>${getProfDatum(username,'posttest','createdAt')}`,
        `td>${getProfDatum(username,'task','funInteresting')}`,
        `td>${getProfDatum(username,'task','improvedEnglish')}`,
        `td>${getProfDatum(username,'task','feedback')}`,

      ]);
      return row;
    },[]);

  }



  socket.on('got-proficiency-data-for-task-stage',data=>{
    //console.log('got-proficiency-data-for-task-stage',data.profRows);
    $('#profData').remove();
    addProfData(data);
    const els = [
      'table#profData',
      ...getProfDataRows()
    ];
    console.log(els);
    elem.as(els).to($('#content')[0]);
  });

  socket.on('got-all-proficiency-data-for-task-stage',data=>{
    console.log('got-all-proficiency-data-for-task-stage',data.profRows);
    const {profRows} = data;
    let answerLen = 0;
    let indexString = '';
    const rows = [];
    function eliminateDoubles(answers){
      answers.sort((b,a)=>{return a.points - b.points;});
      const answered = {};
      answers = answers.reduce((as,a)=>{
        const key = `${a.index}.${a.trans}`;
        if(!answered[key]){
          answered[key] = a;
          as.push(a);
        }
        return as;
      },[]);
      answers.sort(function(a,b){return a.index-b.index;});
      answers.sort(function(a,b){return a.trans - b.trans;});
      return answers;
    }
    profRows.forEach(p=>{
      const adjustments = [];
      const {username} = p;
      let {answers} = p;
      if(!answers || !answers.length){
        return;
      }
      answerLen = !answerLen ? answers.length : answerLen;
      if(answerLen!=answers.length){     
        console.log(`WARNING: answer length does not match for ${p.username}: ${answers.length} VS ${answerLen}`);
        answers = eliminateDoubles(answers);
        if(answerLen != answers.length){
          console.log(`WARNING: answer length STILL does not match for ${p.username}: ${answers.length} VS ${answerLen}`);
          return;
        }
        adjustments.push('fixed answer length');
      }
      answers.sort(function(a,b){return a.index-b.index;});
      answers.sort(function(a,b){return a.trans - b.trans;});
      const indexes = answers.map(a=>a.index);
      indexes.sort();
      if(!indexString){
        indexString = indexes.join(',');
      }
      if(indexes.join(',')!=indexString){     
        console.log(`WARNING: indexes not match for ${p.username}: \n${indexes} \nVS\n ${indexString}\n`);
        answers = eliminateDoubles(answers);
        const newIndexes = answers.map(a=>a.index);
        if(newIndexes.join(',')!=indexString){
          console.log(`WARNING: indexes STILL do not match for ${p.username}: \n${indexes} \nVS\n ${indexString}\n`);
          return;
        }
        adjustments.push('fixed indexes');
      }
      const rearrangedAnswers = [];
      const hasTrans = {};
      answers.forEach(a=>{
        a.points = a.points ? a.points : 0;
        hasTrans[a.index] = a.trans ? 1 : 0;
      });
      answers.sort((a,b)=>{return hasTrans[a.index]-hasTrans[b.index];})
      answers.sort((a,b)=>{return a.trans - b.trans;});
      console.log(answers.map(a=>a.index).join('\t'));
      const form =answers.reduce((sum,a)=>{
        if(a.trans){
          return sum;
        }
        sum += a.points;
        return sum;
      },0);
      const meaning =answers.reduce((sum,a)=>{
        if(a.trans){
          sum+=a.points;
        }
        return sum;
      },0); 
      const row = [username,getProfDatum(username,'task','experimentalCondition'),form,meaning,...answers.map(a=>a.points),...adjustments];     
      rows.push(row.join('\t'));
    });
    console.log('item scores:\n\n',rows.join('\n'));

    
  });

  socket.emit('get-survey-data');

  var surveyData = '';
  socket.on('got-survey-data',(data)=>{
    surveyData = data;
    console.log('got-survey-data', data);
  });

  function getProfForUser(username,stage=false){
    console.log('get-proficiency-data-for-user',{username,task,stage});
    socket.emit('get-proficiency-data-for-user',{username,task,stage});
  }

  socket.on('got-proficiency-data-for-user',data=>{
    const {prof} = data;
    console.log('got-proficiency-data-for-user',data);
    console.log('prof',prof);
  });

  

  // socket.on('report-room-progress',data=>{
  //   reportRoomProgress(data);
  // });





// },2000);

