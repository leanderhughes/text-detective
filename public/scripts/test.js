//const { data } = require("jquery");

const trialMode = true;

const testComplete = {};

const charWidth = 20;//parseFloat(window.getComputedStyle(testDiv,null).getPropertyValue('font-size'));


function getInputByIndex(index){
     let el = '';
    $('input').each(function(){
        if($(this).data('index')==index){
            el = this;
        }
    });
    return el;
}

function focusOnInput(input){
    if(!input){
        return;
    }
    input.focus();
    if(!$(input).hasClass('highlighted')){
        $('.highlighted').removeClass('highlighted');
        $(input).addClass('highlighted')
    }
    if($('.highlighted').length>1){
        $('.highlighted').removeClass('highlighted');
        $(input).addClass('highlighted')   
    }
    scrollIntoView(input,{behavior:'smooth',block:'center'});
    return true;

}


function handleInputKeydown(that){
    let keyCode = that.keyCode;
    let event = that;
    if(!that.tagname){
        that = this;
    }
    const dat = that.dataset;
    if(!dat){
        return;
    }
    that.value = that.value ? that.value.toLowerCase() : that.value;
    const val = this.value;
    const prevVal = dat.prevVal;
    const index = parseFloat(dat.index);
    that.dataset.prevVal = val;
    if(keyCode){
        if({37:1,38:1,39:1,40:1,13:1,9:1,32:1}[keyCode]){

            const {selectionStart,selectionEnd} = that;
            if([37,38,39,40].includes(keyCode)){
                if(selectionStart!=selectionEnd){
                    return;
                }
                if(keyCode==37 && selectionStart!=0){
                    return;
                }
                if(keyCode==39 && selectionStart!=val.length){
                    return;
                }
            }        
            if(keyCode==37 || keyCode==38){
                event.preventDefault();
                const prevInput = getInputByIndex(index-1);
                focusOnInput(prevInput);//prevInput && prevInput.focus() && prevInput.scrollIntoView({behavior:'smooth',block:'center'});
            }
            if({39:1,40:1,13:1,32:1,9:1}[keyCode]){
                event.preventDefault();
                const nextInput = getInputByIndex(index+1);
                if(
                    $('#testNextButton').hasClass('still-visible') &&
                    !$(that).hasClass('translation-item') &&
                    $(nextInput).hasClass('translation-item')
                ){
                    focusOnInput(document.getElementById('testNextButton'));
                    return;
                }           
                nextInput ? focusOnInput(nextInput) : focusOnInput(document.getElementById('testSubmitButton'));
            }
            return;
        }
    }

}

function updateTestQuestionCount(el){
    const totalCount = $('#test-question-count').data('total-question-count');
    const questionIndex = el.dataset.index;
    $('#test-question-count').html(`${questionIndex}/${totalCount}`)
}

function handleInputFocus(){
    $('.highlighted').removeClass('highlighted');
   // $(this).removeClass('error-text');
    $(this).addClass('highlighted');
    updateTestQuestionCount(this);
}

function handleInputKeyup(e){
    this.value = this.value ? this.value.toLowerCase() : this.value;
    const dat = this.dataset;
    if(!dat){
        return;
    }
    const val = this.value;
    const valLen = (val.length < 2 ? 2 : val.length)*($(this).hasClass('translation-item') ? 2 : 1);
    this.style.width = (charWidth*valLen)+'px';
    const prevVal = dat.prevVal;
    const index = parseFloat(dat.index);
    this.dataset.prevVal = val;
    if(!val && !prevVal && e.keyCode==8){
        const prevInput = getInputByIndex(index-1);
        focusOnInput(prevInput);
    }
}

function getActiveInputData(){
    return getInputData(getActiveInput());
}

function getActiveInput(){
    return document.activeElement && document.activeElement.tagName && document.activeElement.tagName.toLowerCase()=='input' ? document.activeElement : false;
}

function getInputData(input){
    if(!input){
        return input;
    }
    return {
        itemIndex:parseFloat($(input).data('item-index')),
        inputIndex:parseFloat($(input).data('index')),
        string:input.value,
        hasAnswer:$(input).data('hasAnswer')
    }
}

function saveAndCheckWord(){
    socket.emit('check-and-save-word',getInputData(this));
}

socket.on('removed-alt-word',data=>{

    const {inputIndex,altWord} = data;
    const input = getInputByIndex(inputIndex);
    const answerBox = $(input).parent().find('.test-answers')[0];

    if(input.dataset.stringStart+input.value==altWord){
        input.value='';
    }

    $(answerBox).find('.test-answer').each(function(){

        if($(this).text().trim()==altWord){
            $(this).remove();
            centerAnswerBox(input,answerBox);
        }
    });
    $(answerBox).find('.test-answer').length==1 && setTimeout(function(){
        $(answerBox).find('.test-answer').hide()
    },1500); 
});

function createAltWordBox(a,input){
    return elem.as(
        {
            span:{
                text:a,
                className:'test-answer',
                style:{
                    display:'none'
                }
            }
        },
        {
            span:{
                text:' <i class="fas fa-times-circle"></i>',
                onclick:function(){
                    $(this).parent().addClass('waiting');
                    socket.emit('remove-alt-word',{altWord:a,inputIndex:parseFloat($(input).data('index')),itemIndex:parseFloat($(input).data('item-index'))});
                }
            }
        }
    );
}

function centerAnswerBox(input,answerBox){
    if(!input||!answerBox){
        return true;
    }
    const spanRect = input.getBoundingClientRect();
    const elRect = answerBox.getBoundingClientRect();
    answerBox.style.left = Math.round((spanRect.width-elRect.width)/2)+'px';
    return true;
}



function addInput(word,answer){
    //this.innerHTML=this.innerHTML.replace(/_/g,'<input type="email" autocorrect="off" autocapitalize="none" size="1" style="max-width:20px;">');
    let charCount = word.innerHTML.split('_').length;
    word.innerHTML = word.innerHTML.replace(/_/g,'');
    const inputCount = $('#test input').length+1;
    const input = elem.as({
        input:{
            type:'text',
            autocorrect:'off',
            autocapitalize:'off',
            autocomplete:'off',
            spellcheck:false,
            style:{
                width: (charWidth*2)+'px'
            },
            callback:function(el){
                if(answer){
                    $(el).data('hasAnswer',true);

                }
                $(el).on('keydown',handleInputKeydown);
                $(el).on('keyup',handleInputKeyup);
                $(el).on('change',saveAndCheckWord);
                $(el).on('focus',handleInputFocus);
            }
        }
    });
    input.dataset.index = inputCount;
    input.dataset.itemIndex = word.dataset.index;
    if(word.dataset.index!=answer.index){
        console.log(inputCount,'VS',answer.index);
        showMessage('Error: Test loading failed due to mismatched item indexes. Please ask your teacher for help.');
        return {error:'index mismatch'};
    }
    input.dataset.stringStart = $(word).text();
    if(answer){
        input.dataset.answer = answer.word;
    }

    const span = elem.as({
        span:{
            style:{
                position:'relative',
                display:'inline-block'
            }
        }
    });
    const inputIndexDiv = elem.as({
        div:{
            text:inputCount,
            className:'input-index-div'

        }
    });
    if(answer && isTeacher && localStorage.getItem('teacherMode')){
        const answerBox = elem.as({
            div:{
                className:'test-answers',
                    callback:function(el){
                    centerAnswerBox(input,el);
                }
            }
        });
        const {altWords} = answer;

        $(answerBox).append(elem.as({
            span:{
                text:' ... ',
                className:'show-test-answers',
                style:{
                    display: altWords && altWords.length ? '' : 'none'
                },
                onclick:function(){
                    $(answerBox).find('.test-answer').show();
                    $(this).hide();
                    const that = this;
                    centerAnswerBox(input,answerBox);
                    setTimeout(function(){
                        $(answerBox).find('.test-answer').hide();
                        $(that).show();
                        centerAnswerBox(input,answerBox);
                    },5000);
                }
            }
        }));
        $(answerBox).append(elem.as({
            span:{
                text:answer.word,
                className: 'test-answer',
                style:{
                    display:'none'
                }
            }
        }));
        altWords && altWords.forEach(a=>{
            answerBox.append(createAltWordBox(a,input));
        });
        $(span).append(answerBox);
    }
    $(span).append(inputIndexDiv);
    $(span).append(input); 
    $(word).append(span);
    return span;
}

function addTransInput(wordSpan,itemIndex,answer){
    const inputCount = $('#test input').length+1;
    const input = elem.as({
        input:{
            className:'translation-item',
            type:'text',
            autocorrect:'off',
            autocapitalize:'off',
            autocomplete:'off',
            spellcheck:false,
            style:{
                width: (charWidth*2)+'px'
            },
            callback:function(el){
                if(answer){
                    $(el).data('hasAnswer',true);

                }
                $(el).on('keydown',handleInputKeydown);
                $(el).on('keyup',handleInputKeyup);
                $(el).on('change',saveAndCheckWord);
                $(el).on('focus',handleInputFocus);
            }
        }
    });
    input.dataset.index = inputCount;
    const prevIndex = parseFloat($(wordSpan).find('input')[0].dataset.index);
    const prevItemIndex = parseFloat($(wordSpan).find('input')[0].dataset.itemIndex);
    input.dataset.itemIndex = prevItemIndex+.1;
    input.dataset.stringStart = '';//$(word).text();
    const span = elem.as({
        span:{
            className:'translation-span',
            style:{
                position:'relative',
                display:'inline-block',
                marginLeft:'10px'
            }
        }
    });
    const inputIndexDiv = elem.as({
        div:{
            text:inputCount,
            className:'input-index-div'

        }
    });
    const nihongoDiv = elem.as({
        div:{
            text:prevIndex+'の日本語',
            className:'nihongo-div'
        }
    });
    //Teacher stuff here...
    $(span).append(inputIndexDiv);

    $(span).append(nihongoDiv);

    $(span).append(input); 
    $(wordSpan).after(span);
    return input;
}

function addAltWord(input,altWord,flashFull=false){
    const answerBox = $(input).parent().find('.test-answers')[0];
    $(answerBox).append(createAltWordBox(altWord,input));
    const $showAns = $(answerBox).find('.show-test-answers');
    if(!flashFull){
        $showAns.show();
        centerAnswerBox(input,answerBox);
        return true;
    }
    $(answerBox).find('.test-answer').show();
    centerAnswerBox(input,answerBox);
    setTimeout(function(){
        $(answerBox).find('.test-answer').hide();
    centerAnswerBox(input,answerBox);
    centerAnswerBox(input,answerBox);
        $(answerBox).find('.test-answer').length > 1 && $showAns.show() && centerAnswerBox(input,answerBox);
    },5000);
}

socket.on('feedback-on-word',data=>{
    const {itemIndex,inputIndex,spellingCorrect,newAltWord} = data;

    const input = getInputByIndex(inputIndex);
    spellingCorrect ? $(input).removeClass('error-text') : $(input).addClass('error-text');
    newAltWord && addAltWord(input,newAltWord,'flashFull');
});

socket.on('test-complete',(stage)=>{
    testComplete[stage]=1;
    $('#content').hide();
    alertMessage('Test complete!',function(){
        $('#content').show();
    });
});

function trial(name){
    $('#trial').remove();
    $('#test').prepend(elem.as('div#trial>'+name));
}

function warn(elId,flash=0){
    if(typeof elId=='string'){
        if(elId[0].match(/a-zA-Z/)){
            elId = '#'+elId;
        }
        elId = $(elId)[0];
    }
    flash % 2 == 0 ? $(elId).addClass('warn') : $(elId).removeClass('warn');
    if(flash>=4){
        return;
    }
    flash++;
    setTimeout(function(){
        warn(elId,flash)
    },(flash+1)*150);

}

socket.on('deleted-records-after-test-load',()=>{
    
    location.href = '/../..';
});

const blurEveryOtherWordOnTest = true;

function addAnswersTimerAndFocusWhenReady(stage,answers,timeLeft=false,isTeacher){
  
    if($('#test input').length < answers.length){
        setTimeout(function(){
            addAnswersTimerAndFocusWhenReady(stage,answers,timeLeft,isTeacher);
        },100);

        return;
    }

    urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has('deleteRecordsAfterTestLoad') && isTeacher){
        socket.emit('delete-records-after-test-load');
        
        return;
    }
    $('.translation-span').hide();
    const teacherMode = isTeacher && localStorage.getItem('teacherMode');
    //<i class="fas fa-toggle-on"></i>
    isTeacher && $('#test').prepend(elem.as(
        {
            div:{
                style:{
                    margin:'40px 0px 40px 0px'
                }
            }
        },
        {
            span:{
                text:teacherMode ? '<i class="fas fa-toggle-on"></i>' : '<i class="fas fa-toggle-off"></i>',
                id:'teacherModeToggle',
                onclick:function(){
                    this.innerHTML = !teacherMode ? '<i class="fas fa-toggle-on"></i>' : '<i class="fas fa-toggle-off"></i>';
                    localStorage.setItem('teacherMode',teacherMode ? '' : 'teacherMode');
                    setTimeout(function(){
                       window.location.reload();
                    },500);
                }

            }
        },
        {
            span:{
                text:' Teacher Mode',
                style:{
                    fontSize:'16px'
                },
                onclick:function(){
                    $('#teacherModeToggle').trigger('click');
                }
            }
        }
    ));
    $('#test').append(elem.as(
        {
            div:{
                id:'test-question-count-container',
            }
        },
        1,
            getQuestionIcon(),
        -1,
    

        
        {
            span:{
                id:'test-question-count',
                callback:function(el){
                    el.dataset.totalQuestionCount = answers.length;
                    $('#test input').each(function(){
                        if(!this.value){
                            focusOnInput(this);
                           // $(this).addClass('highlighted');
                            return false;
                        }
                    }); 
                }
            }
        }
    ));
    $('#test').append(elem.as(
        'div#testTimer><i style="color:white" class="far fa-clock"></i> ',
        {
            span:{
                id:'testTimeLeft',
                text:msToTime(timeLeft),
                callback:function(el){
                    let prevDate = Date.now();
                    let prevTimeLeft = '';
                    let warned = false;
                    function tick(){
                        if(testComplete[stage]){
                            return;
                        }
                        const now = Date.now();
                        const delta = now-prevDate;
                        timeLeft-=delta;
                        if(!teacherMode && timeLeft<=0){
                            if(!timeLimitOff || !isTeacher){
                                !isAssistant && socket.emit('test-time-up',getActiveInputData());
                                $(`#${stage}`).hide();
                                showMessage('Time up!');
                                showMessage('Loading next stage... Please wait a moment.');
                                return;                  
                            }
                        }
                        if(!warned && timeLeft<=60000){
                            warn('#testTimer');
                            warned = true;
                        }
                        prevDate = now;
                        if(prevTimeLeft!=timeLeft){
                            el.innerHTML = msToTime(timeLeft);
                        }
                        prevTimeleft = timeLeft;
                        setTimeout(tick,30);
                    }
                    tick();
                }
            }
        }
    ));
    $('#test').append(elem.as({
        button:{
            id:'testSubmitButton',
            text:'Submit Test',
            onclick:function(){
                const button = this;
                button.disabled = true;
                let unfinishedInput = '';
                $('#test input').each(function(){
                    if(!this.value){
                        unfinishedInput = this;
                        return false;
                    }
                });
                const msg = lang(
                    `Are you sure you want to submit this test?${(unfinishedInput ? ' You have left some items blank.' : '')}`,
                    `テストを終了しますか？${(unfinishedInput ? 'まだ答えていない問題が残っています。' : '')}`
                );
                showMessage([
                    'div',
                    `p>${msg}`,
                    {
                        button:{
                            text:`Yes, submit this test now.`,
                            onclick:function(){    
                                socket.emit('finish-test',getActiveInputData());
                                $('#trial').length && $('#trial').text() && socket.emit('save-trial',$('#trial').text().trim());
                                $('.sequence').find('.loading-stage').show();
                                closeMessage();
                            },
                            style:{
                                marginRight:'20px'
                            }
                        }
                    },
                    {
                        button:{
                            text:unfinishedInput ? 'No, let me work more.' : `Cancel`,
                            onclick:function(){
                                unfinishedInput && focusOnInput(unfinishedInput);
                                closeMessage();
                                button.disabled = false;
                            }
                        }
                    }
                ],function(){  
                    closeMessage();
                    button.disabled = false;     
                });
            },
            callback:function(el){
                $(el).on('focus mouseover click',function(){
                    $(this).addClass('highlighted');

                });
                $(el).on('blur mouseout mouseup',function(){
                    $(this).removeClass('highlighted');
                });
            },
            style:{
                display:'none'
            }
        }
    }));
    $('#test').append(elem.as({
        button:{
            text:'NEXT: Do Translation Questions',
            id:'testNextButton',
            className: 'still-visible',
            onclick:function(){
                $(this).removeClass('still-visible');
                $(this).hide();
                $('.translation-span').show();
                $('#testSubmitButton').show();
                setTimeout(function(){
                    $('.translation-span').find('input')[0].scrollIntoView({behavior:'smooth',block:'center'});
                    $($('.translation-span')[0]).find('input')[0].focus();
                },500);
            }
        }
    }));
    answers.forEach(a=>{
        if(a.inputIndex && a.response){
            const input = getInputByIndex(a.inputIndex);
            input.value = a.response;
            !a.spellingCorrect && $(input).addClass('error-text');
            if(input.value){
                input.style.width = (charWidth*input.value.length*($(input).hasClass('translation-item') ? 2 : 1))+'px';
            }
        }
    });
    // $('#test input').each(function(){
    //     if(!this.value){
    //         focusOnInput(this);
    //         $(this).addClass('highlighted');
    //         return false;
    //     }
    // });
    let wCount = 0;
    let prevPrevWord = '';
    let prevWord = '';
    blurEveryOtherWordOnTest && $('#test').find('.w').each(function(){
        wCount++;

        if(
            wCount>=20 && 
            wCount % 2 == 1 && 
            !$(prevWord).find('strong').length &&
            !$(prevWord).find('input').length && 
            !$(this).find('input').length && 
            !$(prevPrevWord).find('input').length
        ){
            const wordText = $(prevWord).text();
            if(wordText.match(/\w/)){
                $(prevWord).html(wordText.slice(0,wordText.length/2)+`<span class="blurred-more">${wordText.slice(wordText.length/2)}</span>`);
            }
        }
        prevPrevWord = prevWord;
        prevWord = this;
    });
    console.log('done adding answers');
    $(`#${currentStage}`).find('.loading-test').hide();
}


socket.on('got-test',(data)=>{

    $('#test').remove();
    console.log('got-test',data);

    const {stage,text,answers,timeLeft,isTeacher} = data;
    console.log('answers.length',answers.length);

    const div = document.querySelector(`#${stage}`);
    elem.as(
        'div',
        {
            div:{
                id:'testQuill',
                style:{
                    display:'none'
                },
                callback:function(){
 
                    const testQuill = loadQuillOutput('testQuill','test',text,function(el,word,index){return;});
                    $('.ql-toolbar').remove();
                    let itemCount = 0;
                    const spansToTrans = [];
                    let errorStopTest = false;
                    $('.w').each(function(){
                        const that = this;
                        const innerText = $(this).text();
                        if(innerText.match(/_/)){
                            const wordSpan = addInput(this,answers[itemCount]);//isTeacher || answers[itemCount] && answers[itemCount].word ? answers[itemCount] : false);
                            if(wordSpan && wordSpan.error){
                                $('#test').hide();
                                $('.loading-test').html(`Error: ${wordSpan.error}`);
                                console.log('wordSpan error',wordSpan.error);
                                errorStopTest = true;
                                return false;
                            }
                            if(answers[itemCount+1] && answers[itemCount+1].trans){
                                spansToTrans.push({iCount:itemCount,wordSpan});
                                //addTransInput(wordSpan,isTeacher ? answers[itemCount] : false);
                                itemCount++;
                            }
                            itemCount++;
                            return true;
                        }
                        if(innerText==' ' || innerText=='&nbsp;'){
                            //$(this).addClass('space');
                            that.outerHTML = ' ';
                        }
                        else if(innerText.indexOf('&nbsp;')>-1 || innerText.match(/\s/)){
                            const spaceBlanked = innerText.replace(/&nbsp;/g,'_').replace(/\s/g,'_');
                            if(spaceBlanked.replace(/_/g,'').match(/\W/)){
                                // if(spaceBlanked[0]!='_' && spaceBlanked.slice(-1)=='_'){
                                //     $(this).addClass('punc-space-right');
                                // }
                                // else if(spaceBlanked.slice(1)!='_' && spaceBlanked.slice(-1)!='_'){
                                    that.outerHTML = spaceBlanked.replace(/_/g," ");
                                // }
                                // else{
                                //     $(this).addClass('punc-space-left');
                                // }
                            }

                          
                        }
                        else{
                            
                        }
                    });
                    if(errorStopTest){
                        return;
                    }
                    spansToTrans.forEach(s=>{
                        const {iCount,wordSpan} = s;
                        addTransInput(wordSpan, iCount, answers[iCount]);
                        
                    });
                    alertMessage(
                        lang(
                            `Fill in the missing parts of the words in rectangular boxes and the Japanese translations in the round boxes.      
                            When you click the 'Next: Do Translation Questions' button at the bottom, the translation questions will appear.
                            <br><br>
                            You can leave an item blank if you do not know the correct word.        
                            There are ${itemCount} items and your remaining time is ${msToTime(timeLeft)}. 
                            Try to finish as many items as you can before the time is up. Good luck!`,
                            `長方形の空欄には英単語の足りない部分を、丸い空欄には日本語訳を入力してください。文章の一番下まで行き、"Next: Do Translation Questions"をクリックすると日本語訳の問題の回答欄が現れます。<br><br>わからないところは飛ばしてわかる箇所から回答しましょう。
                            全部で空欄は${itemCount}個あり、制限時間は${msToTime(timeLeft)}分です。
                            時間切れになるまでにいくつの空欄を正しく埋められるかやってみましょう。Good luck! 
                            `
                        )
                    );
                    addAnswersTimerAndFocusWhenReady(stage,answers,timeLeft,isTeacher);

                }
            }
            //'div#testQuill'
        },
        'div#test'
    ).to(div);
   
});




if(isTestUser()){
    let guessing = false;
    function guess(word){
        if($('input').length){
            $('input').each(function(){
                if(!$(this).data('string-start')){
                    return true;
                }
                if(!this.value || !this.value.match(/\w/)){

                 
                    this.value = word;//word.slice($(this).data('string-start') ? $(this).data('string-start').length : 0);
                    $(this).trigger('focus');

                    socket.emit('check-and-save-word',getInputData(this));

                    return false;
                }
            });
        }
    }
    // socket.on('got-random-word',word=>{
    //     if(!word || word.match(/\W/)){

    //         word = 'ummmm';
    //     }
    //     guessing && guess(word);

    // });
    const willTimeout = Math.random() > .6;
    //console.log('willTimeout',willTimeout);
    const testSubmittedForThisStage = {};
    function automaticallySubmitTest(){
        return;
        console.log('automatically submitting test');
        if(testSubmittedForThisStage[currentStage]){
            console.log('...already submitted ',currentStage);
            return;
        }
        testSubmittedForThisStage[currentStage]=true;
        $('#testSubmitButton').show();
        $('#testSubmitButton').trigger('click');
    }
    function guessRandomWord(){
        guessing = true;
        if(!pauseTestUser && $('input').length){
            let completed = 0;
            let all = 0;

            let gotRandomWord = false;
            
            $('input').each(function(){
                if(!$(this).data('string-start')){
                    return true;
                }
                if(!$(this).is(':visible')){
                    return true;
                }
                all++;
                if(this.value && this.value.match(/\w/)){
                    completed++;
                }
                if(!gotRandomWord && (!this.value || !this.value.match(/\w/))){
                    //socket.emit('get-random-word',$(this).data('string-start'));
                    guess(getRaveWord($(this).data('string-start')));
                    gotRandomWord = true;
                }

            });

            if(!all){
                setTimeout(guessRandomWord,3000*Math.random()+3000);
                return;
            }


            if(!willTimeout && completed/all > .5 && Math.random()<completed/all){
                automaticallySubmitTest();
            }
            
        }
        
        
        setTimeout(guessRandomWord,3000*Math.random()+3000);
    }

    function enterCorrectWord(){
        guessing = true;
        if(!pauseTestUser && $('input').length){
            let completed = 0;
            let all = 0;

            let gotRandomWord = false;

            let visibleCount = 0;
            
            $('input').each(function(){
                if(!$(this).data('string-start')){
                    return true;
                }
                if(!$(this).is(':visible')){
                    return true;
                }
                all++;
                if(this.value && this.value.match(/\w/)){
                    completed++;
                }
                if($(this).is(':visible')){
                    visibleCount++;
                }
                if(!gotRandomWord && (!this.value || !this.value.match(/\w/))){
                    //socket.emit('get-random-word',$(this).data('string-start'));
                    const stringStart = $(this).data('string-start');
                    guess($(this).data('answer') ? $(this).data('answer').replace(stringStart,'') : 'uh');
                    gotRandomWord = true;
                }

            });

            if(!all){
                setTimeout(enterCorrectWord,3000*Math.random()+3000);
                return;
            }


            if(completed>=visibleCount){//!willTimeout && 
                automaticallySubmitTest();
            }
            
        }
        
        
        setTimeout(enterCorrectWord,2000);
    }


    //setTimeout(guessRandomWord,3000);
    setTimeout(enterCorrectWord,2000);

}