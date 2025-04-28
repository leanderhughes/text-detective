const questionContainer = document.getElementById('question-container');

const targetTimeIcon = `
<div class="target-time-icon" alt="Suggested Time for this Item" title="Suggested Time for this Item" onclick="showIconInfo(this,'Suggested Time for this Item')">
  <i class="fas fa-check"></i>
  <i class="far fa-clock"></i>
</div>
`;

/*
    recommendedFinishingTimes

      const wordNoteTime = <%= locals.wordNoteTime || 0 %>;
      const sectionNoteTime = <%= locals.sectionNoteTime || 0 %>;
      const itemTimeChat = <%= locals.itemTimeChat || 0 %>;
      const itemTimeNote = <%= locals.itemTimeNote || 0 %>;


*/

let showedBeginMessage = false;
function showBeginMessage(basePrompt){

    if(showedBeginMessage){
        return;
    }
    showMessage(`
        <h3>TASK! <span style="text-decoration:underline">${tdVersion.toUpperCase()}</span> VERSION</h3>

        ${basePrompt}
    `);

    showedBeginMessage = true;
}
function showWitnessQuestion(data){
    elem.clear(questionContainer);
    const msg = lang(
        `<span class="witness-role-emphasis">You are a witness ${icons.witness}.</span> Help the detective ${icons.detective} find their suspect word by chatting about the highlighted section of text above!`,
        `<span class="witness-role-emphasis">あなたは目撃者役${icons.witness}です。</span>黄色い線が引かれている部分の内容についてメッセージを送り、探偵役${icons.detective}がキーワードを見つけるのを手伝いましょう。`
    );
    showBeginMessage(msg);
    setTargetTimer(itemTimeChat);
    elem.as(`p>${msg}`).to(questionContainer);
    highlight(data.sectionStart,data.sectionEnd);
    scrollToWord(data.sectionEnd);
    return true;
}

function setTargetTimer(ms){
    const timerId = `target-timer_${new Date().getTime()}`;
    return elem.as(
        `div.target-time-container>${targetTimeIcon}`,
        {
            span:{
                id:timerId,
                text:'__:__',
                style:{
                    display:'inline-block'
                },
                callback:function(el){
                    $(el).html(msToTime(ms));
                    const startDate = new Date().getTime();
                    let timeout = '';
                    function tick(){
                        if(!$(`#${timerId}`).length){
                            timeout && clearTimeout(timeout);
                            return;
                        }
                        const now = new Date().getTime();
                        const timeLeft = ms - (now - startDate);
                        $(el).html(msToTime(timeLeft < 0 ? 0 : timeLeft));
                        if(timeLeft<0){
                            return;
                        }
                        timeout = setTimeout(tick,30);
                    }
                    tick();
                }
            }
        }
    ).to(questionContainer);
}

function showNotePrompt(data){
    elem.clear(questionContainer);
    const {contentType} = data;
    const msg = lang(
        `${tdVersion=='note' ? 'Type a note in the chat box about' : 'Read and study'} the highlighted ${contentType} in the text. This will be a clue to help you solve a mystery later.`,
        `黄色く線が引かれている部分${tdVersion=='note' ? 'についてノートをとり、後で謎を解く際の手がかりを残しましょう。' : 'を読んで、内容を把握しましょう。後で問題を解く際の手がかりになります。'}`
    );
    console.log('tdVersion',tdVersion);
    console.log('msg',msg);
    setTargetTimer(contentType == 'word' ? wordNoteTime : sectionNoteTime);
    showBeginMessage(msg);
    elem.as(`p>${msg}`).to(questionContainer);
    data.contentType=='section' ? highlight(data.sectionStart,data.sectionEnd) : highlight(data.keywordIndexes);
    setTimeout(function(){
        data.contentType=='section' ? scrollToWord(data.sectionStart + Math.round((data.sectionEnd - data.sectionStart)/2)) : scrollToWord(data.keywordIndexes[0]);
    },1000);
    $('#note-index').html(data.index);
    $('#note-count').html(data.noteCount);
    $('#send-button').hide();
    $('#question-index-container').hide();
    $('#note-index-container').show();
    $('#save-note').show();
    $('#finish-note').show();
    if(tdVersion == 'read'){
        $('#save-note').hide();
        $('.ql-content').hide();
        $('#message-container').hide();
        $('#message-pre-input').hide();
       
        $('#finish-note').html(
            lang(
                'Show next',
                '次に進む'
            )
        );
    }
}

function getQuestionIcon(fontSize='inherit'){
    fontSize = fontSize == 'inherit' ? window.getComputedStyle($('#note-index-container')[0], null).getPropertyValue('font-size') : fontSize;
    fontSize = parseFloat(fontSize);
    const adjustedFontSize = Math.round(fontSize*.85)+'px';
    return elem.as(     {
        span:{
            text:`<i class="far fa-question-circle" style="font-size:${adjustedFontSize}"></i> `,
            style:{
                position:'relative',
                fontSize:adjustedFontSize,
                display:'inline-block',
                alt:'Mystery',
                title:'Mystery'
            },
            onclick:function(){
                showIconInfo(this,'Mystery');
            }
        }
    },
    {
        div:{
            style:{
                backgroundColor:'white',
                display:'block',
                position:'absolute',
                zIndex:999,
                transform: 'rotate(45deg) scaleX(-1)'

            },
            callback:function(el){
                function adjustSize(){
                    const parent = $(el).parent()[0];
                    const rect = parent.getBoundingClientRect();
                    if(!rect.width){
                        setTimeout(adjustSize,300);
                        return;
                    }
                    const i = $(parent).find('i')[0];
                    i.style.top = Math.round(rect.height*-.1)+'px';
                    el.style.width = Math.round(rect.width/6.5)+'px';
                    el.style.height = Math.round(rect.width*2/6.5)+'px';
                    el.style.top = Math.round(rect.height*.67)+'px';
                    el.style.left = Math.round(rect.width/-8.7)+'px';
                }
                adjustSize();

            }
        }
    });
}

setTimeout(function(){
    $('#question-index-container').prepend(getQuestionIcon());  

},1500);

function getDetectiveChatPrompt(data){
    if(data.complete){
        return lang(
            `The other detective is still working on this mystery. Chat with them to help them choose the correct word!`,
            `もう一人の探偵役はまだ答えていません。チャットボックスにメッセージを送って、回答するのを手伝いましょう。`
        );
    }
    return lang(
        `<span class="detective-role-emphasis">You are a detective ${icons.detective}</span>. Chat with the witness ${icons.witness} to answer this question: Which suspect word below is in the highlighted part of the witness's text?`,
        `<span class="detective-role-emphasis">あなたは探偵役${icons.detective}です。</span>目撃者役${icons.witness}とメッセージをやり取りして謎を解こう！４つの黄色く線が引いてある単語のうち、どの単語が目撃者役の人の文章に含まれているでしょうか？`
    );

}

function highlightNewRole(){
    setTimeout(function(){
        $('.detective-role-emphasis').length && $('.detective-role-emphasis').addClass('role-highlight');
        $('.witness-role-emphasis').length && $('.witness-role-emphasis').addClass('role-highlight');
    },1500);
    setTimeout(function(){
        $('.detective-role-emphasis').length && $('.detective-role-emphasis').removeClass('role-highlight');
        $('.witness-role-emphasis').length && $('.witness-role-emphasis').removeClass('role-highlight');      
    },6000);

}



function showDetectiveQuestion(data){
    elem.clear(questionContainer);
    const prompt = getDetectiveChatPrompt(data);
    showBeginMessage(prompt);
    setTargetTimer(itemTimeChat);
    elem.as(`p>${prompt}`).to(questionContainer);
    !data.complete && elem.as([
        'table',
        'tr',
        ...data.choices.map(choice=>{
            return {
                td:{
                    className:'choice',
                    style:{
                        cursor:'pointer'
                    },
                    text:choice.keyword,
                    onclick:function(){
                        showMessage(
                            lang(
                                `Are you sure you want to choose this word for your answer?`,
                                `この選択肢で間違えありませんか？`
                            ), 
                            {
                                button:{
                                    text:'Yes',
                                    onclick:function(){
                                        this.onclick = function(){console.log('trying to click YES again...');closeMessage();};
                                        submitResponse(choice.keyword);
                                        closeMessage();
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
                        );
                    }
                }
            };
        })
    ]).to(questionContainer);
    const indexes = data.choices.reduce((indexes,choice)=>{
        indexes.push(...choice.keywordIndexes);
        return indexes;
    },[])
    highlight(indexes);
    scrollToWord(indexes[Math.round((indexes.length-1)/2)]);

    return true;
}

function showNoteQuestion(data){
    const {noWordNotes} = data; 
    elem.clear(questionContainer);
    $('#current-round-question-index').html(data.questionIndex);
    $('#send-container').hide();
    const prompt = tdVersion == 'read' ? lang(
        `You are a detective ${icons.detective}. Above, a section of text that you have already read is highlighted in yellow and blurred out. Below that are 'suspect' keywords from the text. Which suspect word is in the blurred section?`,
        `あなたは探偵役${icons.detective}です。上には先ほど読んだ文章があり、その一部に黄色く線が引かれています。下には４つの単語があり、そのうちの一つが不鮮明に表示されている部分に含まれています。不鮮明に表示されている部分に含まれている単語はどれでしょう。上で見られる本文をもとに謎を解きましょう。`



    ) : lang(
        !noWordNotes ? `You are a detective ${icons.detective}. Below is a blurred section from the text and your note about it. Below that are blurred 'suspect' words and your note about each. Use your notes as clues to solve this mystery: Which suspect word is in the blurred section?` : `You are a detective ${icons.detective}. Below is a blurred section from the text and your note about it. Below that are 'suspect' keywords from the text. Use your note as a clue to solve this mystery: Which suspect word is in the blurred section?`,
        !noWordNotes ? `あなたは探偵役${icons.detective}です。以下には不鮮明に表示された文章の一部と先ほど残した手がかりがあります。さらにその下には、不鮮明になった４つの単語とそれらに関するあなたの書いた手がかりです。４つの単語うちただ1つだけが不鮮明に表示された文章中にあります。　先ほど書いた手がかりをもとに次の謎を解きましょう：どの単語が不鮮明に表示された文章の一部にあったのはどれ？` : `あなたは探偵役${icons.detective}です。以下には不鮮明に表示された文章の一部と先ほど残した手がかりがあります。さらにその下には４つの単語があり、そのうちの一つが不鮮明に表示されている部分に含まれています。不鮮明に表示されている部分に含まれている単語はどれでしょう。残した手がかりと、上で見られる本文をもとに謎を解きましょう。`
    );
    tdVersion=='read' && highlightBlurAndScrollTo(data.blurStart,data.blurEnd);
    
    showBeginMessage(prompt);
    setTargetTimer(itemTimeNote);
    elem.as(`p>${prompt}`).to(questionContainer);
    !data.complete && elem.as([
        'div',
        tdVersion=='read' ? 'span' : `p.blurred>${data.blurredSection.replace(/\n/g,'<br>')}`,
        tdVersion=='read' ? 'span' : `p>${data.sectionNote}`,
        'table',
        'tr',
        ...data.choiceNotes.map((note,i)=>{
            return {
                td:{
                    className:'choice',
                    style:{
                        cursor:'pointer'
                    },
                    text:!noWordNotes ? `<p class="blurred">${data.blurredKeywords[i]}<p><p>${note}</p>` : `<p>${note}</p>`,
                    onclick:function(){
                        showMessage(
                            lang(
                                `Are you sure you want to choose this word note for your answer?`,
                                `この選択肢で間違えありませんか？`
                            ),
                            {
                                button:{
                                    text:'Yes',
                                    onclick:function(){
                                        this.onclick = function(){console.log('trying to click YES again...');closeMessage();};
                                        submitResponse(note);
                                        closeMessage();
                                    },
                                    style:{
                                        marginRight:'20px'
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
                        );
                    }
                }
            };
        })
    ]).to(questionContainer);
    return true;
}

function submitResponse(response){
    console.log('submitResponse',response);
    socket.emit('respond',response);
}

function finish(message){
    elem.clear(questionContainer);
    elem.as(`p>${message}`).to(questionContainer);
    setTimeout(function(){
        socket.emit('check-hub');
    },3000);
    return true;
}

let firstQ = true;
let firstGotQuestion = true;
let prevQuestionIndex = -1;
let prevRole = '';
let currentCorrectChoice = '';
socket.on('got-question',data=>{
    tdVersion == 'read' && $('#message-container').hide();
    console.log('got-question',data);
    $('#note-index-container').hide();
    $('#question-index-container').show();
    $('#send-button').show();
    if(data && data.done){
        finish(data.message);
        return;
    }
    if(data.correctChoice){
        console.log(`currentCorrectChoice = ${data.correctChoice}`);
        currentCorrectChoice = data.correctChoice;
    }
    socket.emit('get-round-ends');

    const {questionIndex} = data;
    if(questionIndex==prevQuestionIndex){
        return;
    }

    prevQuestionIndex = questionIndex;
    

    if(data.choiceNotes){
        $('#send-button').hide();
        showNoteQuestion(data);
        return;
    }

    data.sectionStart && showWitnessQuestion(data);
    data.choices && showDetectiveQuestion(data);
    // firstGotQuestion && $('#save-note').on('click',function(e){
    //     e.preventDefault();
    //     submitForm();
    // });;
    firstGotQuestion = firstGotQuestion && deformatPreInputToSaveNotes() ? false : false;

    const currentRole = data.choices ? 'detective' : 'witness';
    if(currentRole!=prevRole){
        highlightNewRole();
    }
    prevRole = currentRole;
});

let firstGotNote = true;

function saveNote(e){
    if(e.detail.userindex!=myindex){
        return;
    }
    socket.emit('save-note');
}

function saveAndFinishNote2(){
   // $('#finish-note').off('click',formatFinishNote);
    socket.emit('save-and-finish-note');
    window.removeEventListener('chat-message',saveAndFinishNote);
}

function saveAndFinishNote(e){
    deformatFinishNote();//window.removeEventListener('chat-message',saveAndFinishNote);
    if(e && e.detail && e.detail.error){

        return;
    }

    const msg = lang(
        `Are you sure you want to finish ${tdVersion=='note' ? 'this note' : 'this section'} (You cannot come back to it later).`,
        `次に進みますか？（一度進んだら戻れません。）`
    );

    showMessage([
        'div',
        `p>${msg}`,
        {
            button:{
                text:`Yes, I'm finished.`,
                id:'finished-note-confirmation-button',
                onclick:function(){

                    socket.emit('finish-note');
                    closeMessage();
                }
            }
        },
        {
            button:{
                text:`Cancel`,
                onclick:function(){
                    closeMessage();
                }
            }
        }
    ],function(){
        closeMessage();

    });
}

function formatFinishNote(){
    if($('#message-pre-input').text() && $('#message-pre-input').text().trim()){
        window.addEventListener('chat-message',saveAndFinishNote);
        return;
    }
    saveAndFinishNote();
}

//$('#finish-note').on('click',formatFinishNote);

function formatPreInputToSaveNotes(){
    window.addEventListener('chat-message',saveNote);
    return true;
}

function deformatPreInputToSaveNotes(){

    window.removeEventListener('chat-message',saveNote);
    return true;
}

function deformatFinishNote(){
    window.removeEventListener('chat-message',saveAndFinishNote);
    return true;
}
// messagePreInput.addEventListener('keydown',function(e){
//     if(e.key == 'Enter'){
//         e.preventDefault();
//     }
// });




socket.on('got-note',data=>{
    $('#send-button').hide();
    console.log('got-note',data);
    showNotePrompt(data);
    socket.emit('get-round-ends');
    firstGotNote && $('#finish-note').on('click',formatFinishNote);
    firstGotNote = firstGotNote && formatPreInputToSaveNotes() ? false : false;
    
});

socket.on('notes-complete',()=>{
    $('#finish-note').hide();
    $('#save-note').hide();
    highlight();
    socket.emit('get-question');
});

function msToTime(duration) {
    if(typeof duration != 'number'){
        duration = parseFloat(duration);
    }
    const negative = duration < 0 ? '-' : '';
    duration = negative ? duration*-1 : duration;

    var seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60);

    // hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "&nbsp;" + negative+ minutes : negative+minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return minutes + ":" + seconds;
}

let warningHalfTime = false;
let warning

function countDown(roundEnds){
    if(currentStage!='task' || completedTask){
        console.log('blocking time-up',"currentStage!='task' || completedTask",currentStage, completedTask);
        return;
    }
    const ms = roundEnds - Date.now();
    if(ms < 0){
        console.log('check-for-time-up');
        $('#time-left').html('0:00');
        if(!timeLimitOff || !isTeacher){
            !isAssistant && socket.emit('time-up');
        }
        return;
    }

    $('#time-left').html(msToTime(ms));
    this.timeOut && clearTimeout(this.timeOut);
    this.timeOut = setTimeout(function(){
        countDown(roundEnds)
    },30);
    return true;
}

function hyphenate(string){
    return string.split('').reduce((chars,char,index)=>{
        if(!char){
            return chars;
        }
        if(index<string.length-1 && char.match(/[A-Z]/)){
            chars.push('-');
        }
        chars.push(char.toLowerCase());
        return chars;
    },[]).join('');
}

socket.on('got-round-ends',roundEnds=>{
    console.log('got-round-ends',{roundEnds});
    roundEnds ? countDown(roundEnds) : $('#time-left').html('--:--');
});

socket.on('room-stats',data=>{

    const {currentPoints,pointsPossible,currentRound,questionsPerRound,currentQuestionIndex} = data;
    const currentRoundQuestionIndex = currentQuestionIndex - (questionsPerRound * (currentRound-1)) || 1;
    const stats = {currentPoints,pointsPossible,currentRound,questionsPerRound,currentRoundQuestionIndex};
    stats.questionsPerRound = tdVersion != 'chat' ? stats.questionsPerRound * 2 : stats.questionsPerRound;
    Object.keys(stats).forEach(key=>{

        $(`#${hyphenate(key)}`).html(stats[key]);
    });

});

function selectOne(el){
    $(el).parent().find('.selected').removeClass('selected');
    $(el).addClass('selected');
    const value = parseFloat(el.innerHTML);
    const field = $(el).parent().data('field');
    const room = $(el).parent().data('room');

    socket.emit('submit-likert-task-feedback',{field,value,room});
}



socket.on('got-completed-task',data=>{
    foundRoom = true;
    completedTask = true;
    
    console.log('got-completed-task',data);
    const {stats,room,feedback,funInteresting,improvedEnglish,task,canRetry,partners} = data;
    taskId = task;
    const {taskTitle,answerPoints,pointsPossible,taskPoints,messagePoints,profScores,profScoresNoTrans} = stats;
    const completionEls = [
        `div>Congratulations! You have completed the task "${taskTitle}".`,
        'br',
        'br',
        `h2><i class="far fa-lightbulb" alt="Points" title="points" onclick="showIconInfo(this,'Points')"></i> Points`,
        'table',
        'tr',
        'td>Answer Points: ',
        `td> ${answerPoints}`,
        'tr',
        'td>Message Points (Bonus): ',
        `td> ${messagePoints}`,
        'tr',
        'td>Total/Possible: ',
        `td> ${taskPoints}/${pointsPossible}`,
        'br',
        'br',
        partners.length ? 'tr' : 'span',
        partners.length ? `td>Your Partner(s): ${partners.join(', ')}` : 'span'
        
    ];
    console.log('completionEls',completionEls);
    pointsPossible && elem.as(completionEls).to($('#task-complete')[0]);

    const ar = [
        'div',
        'br',
        `h2><i class="fas fa-trophy" alt="Proficiency" title="Proficiency" onclick="showIconInfo(this,'Proficiency')"></i> Proficiency`,
        'table',
        ...Object.keys(profScores).reduce((ar,k)=>{
            ar.push(...[`tr`,`td>${k} `,`td> ${profScoresNoTrans[k]}`]);//ar.push(...[`tr`,`td>${k} `,`td> ${profScores[k]}`]);
            return ar;
        },[])
    ];

    console.log(ar);

    Object.keys(profScoresNoTrans).length && elem.as(ar).to($('#task-complete')[0]);//Object.keys(profScores).length && elem.as(ar).to($('#task-complete')[0]);
    const msg = lang(

        `(Note: Points and Improvement for translation items are not included in these stats because those items have not been checked yet.)`,
        `注：和訳問題の得点と点数の向上は、ここに含まれていません。`
    );

    canRetry && elem.as('div',{
        button:{
            innerHTML:'Try again',
            onclick:function(){
                socket.emit('try-again',{task});
            }
        }
    }).to($('#task-complete')[0]);

    elem.as({
        p:{
            text:msg,
            style:{
                marginTop:'50px',
                marginBottom:'50px',
                fontSize:'12px'
            }
        }
    }).to($('#task-complete')[0]);

    var taskFeedbackTimeout = '';
    function submitFeedback(silent=false){
        if(!$('#task-feedback').length || !$('#task-feedback').is(':visible') ){
            return;
        }
        if(!$('#task-feedback').val() || !$('#task-feedback').val().trim()){
            !silent && showMessage("Please provide some feedback before submitting...");
            return;
        }
        socket.emit('submit-task-feedback',{
            room,
            feedback:$('#task-feedback').val().trim(),
            silent:!!silent
        });
    }
    function submitAfterThreeSeconds(){
        taskFeedbackTimeout && clearTimeout(taskFeedbackTimeout);
        taskFeedbackTimeout = setTimeout(function(){
            if(!$('#task-feedback').length || !$('#task-feedback').is(':visible') ){
                return;
            }
            //submitFeedback('silent');
        },3000);
    }

    room && !$('#task-feedback').length && elem.as('div',{
        a:{
            id:'task-feedback',
            innerHTML:"Please take this google survey about this task",
            href:'https://forms.gle/4uwrroAWyJ27Srba8'
        }
    }).to($('#task-complete')[0]);
/*    
    !$('#task-feedback').length && elem.as(//FIX! Super buggy. Crashes server...
        'div#surveys.survey',
        `p><strong>${
            lang(
                'How was this task? Please provide your feedback in English or Japanese in the box below.',
                'このタスクについてフィードバックをお願いします。質問や提案などを日本語でも英語でも以下に入力してください。（ここの欄の入力は任意です。）'
            )
        }</strong>`,
        {
            textarea:{
                value:feedback===undefined ? '' : feedback,
                id:'task-feedback',

                onblur:function(){
                    //submitFeedback('silent');
                }
            }
        },
        'br',
        'br',
        `p><strong>Please indicate how much you agree with the following statements.</strong>`,
        'br',
        {
            div:{
                innerHTML:`            
                <p><strong>This task was fun/interesting.</strong></p>
                <div class="response likert">      
                <div class="likert-labels"><span class="likert-low-end">Totally disagree</span><span class="likert-high-end">Totally agree</span></div>
                <div> 
                <table>
                    <tr class="likert-values" data-field="funInteresting" data-room="${room}">
                    ${'<td onclick="selectOne(this)">'+[1,2,3,4,5,6,7].join('</td><td onclick="selectOne(this)">')+'</td>'}
                    </tr>
                </table>
                </div>                      
            </div>`
            }
        },
        'br',
        'br',
        {
            div:{
                innerHTML:`            
                <p><strong>This task improved my English.</strong></p>
                <div class="response likert">      
                <div class="likert-labels"><span class="likert-low-end">Totally disagree</span><span class="likert-high-end">Totally agree</span></div>
                <div> 
                <table>
                    <tr class="likert-values" data-field="improvedEnglish" data-room="${room}">
                    ${'<td onclick="selectOne(this)">'+[1,2,3,4,5,6,7].join('</td><td onclick="selectOne(this)">')+'</td>'}
                    </tr>
                </table>
                </div>                      
            </div>`
            }
        },
        'br',
        'br',
        'div',
        {
            button:{
                innerHTML:'Submit Feedback',
                onclick:function(){
                    submitFeedback();
                },
                callback:function(){
                    setTimeout(function(){
                        const likertData = {funInteresting,improvedEnglish};
                        console.log('likertData',likertData);
                        Object.keys(likertData).forEach(key=>{
                            $('.likert-values').each(function(){
                                const row = this;
                                if($(row).data('field')==key){
                                    $(row).find('td').each(function(){
                                        if(parseFloat(this.innerHTML)==likertData[key]){
                                            $(this).addClass('selected');
                                        }
                                    });
                                }
                            });
                        });
                    },300);
                }
            }
        }
    ).to($('#task-complete')[0]);
*/
    //<i class="fas fa-trophy"></i>
  });

socket.on('response-result',data=>{
    console.log('response-result\n',data);
    closeMessage();
    alertMessage(data.message,function(){
        !data.nextMessage && socket.emit('get-question');
        data.nextMessage && alertMessage(data.nextMessage,()=>{
            data.next != 'done' ? socket.emit('get-question') : finish(data.nextMessage);
        });
    })
});

socket.on('response-error',msg=>{
    closeMessage();
    alertMessage(msg);
});

function t(){
    socket.emit('test');
}

$('#save-note').html(
    lang(
        'Save Note',
        'ノートを保存する'
    )
);
$('#finish-note').html(
    lang(
        'Save and Finish',
        'ノートを保存して次に進む'
    )
);

/*


        <button type="submit" id="send-button">Send</button>
        <span style="display:none" id="send-to-select-container">
          <label>Send to 
            <select id="send-to-select" onchange="this.className = this.value=='teacher' ? 'bright-warn' : ''">
              <option value="">Everyone</option>
              <option value="teacher" class="bright-warn">Teacher only</option>
            </select>
          </label>
        </span>
        <button id="save-note" style="display:none">Save Note</button>
        <button id="finish-note" style="display:none">Save &amp; Finish Note</button>


*/

if(isTestUser()){
    let prevAnswerIndex = -1;
    function clickAnswer(){
        const len = $('#question-container').find('.choice').length;
        if(!pauseTestUser && $('#question-container').find('.choice').length){
            let randomChoiceIndex = Math.round(($('#question-container').find('.choice').length -1) *Math.random());
            if(randomChoiceIndex==prevAnswerIndex){
                randomChoiceIndex = (randomChoiceIndex + 1) % 4;
            }
            $('#question-container').find('.choice').slice(randomChoiceIndex,randomChoiceIndex+1).trigger('click');
            prevAnswerIndex = randomChoiceIndex;
        }
        setTimeout(clickAnswer,20*1000);
    }

    function clickCorrectAnswer(){
        
        const len = $('#question-container').find('.choice').length;
        let clickedAlready = {};
        if(!pauseTestUser && currentCorrectChoice && $('#question-container').find('.choice').length){
            console.log('clickCorrectAnswer');
            let answerNotFound = true;
            const possibleChoices = [];
            $('#question-container').find('.choice').each(function(){

                const choiceText = $(this).text().trim();
                
                if(!clickedAlready[choiceText] && choiceText == currentCorrectChoice){
                    answerNotFound = false;
                    console.log('clicking ',choiceText);
                    clickedAlready[choiceText] = true;
                    $(this).trigger('click');

                }
                else if(clickedAlready[choiceText]){
                    console.log('clickCorrectAnswer ',choiceText,' clicked already... frozen???');
                }
                else{
                    console.log('not clicking ',choiceText);
                }
                
                possibleChoices.push(choiceText);
            });
            console.log('clickCorrectAnswer',{answerNotFound,currentCorrectChoice,possibleChoices});
        }
        setTimeout(clickCorrectAnswer,20*1000);
    }
    //clickAnswer();
    clickCorrectAnswer();
}


