const {loadQuillOutput} = quillExtensions;

let users = '';
let userIndex = 0;
let taskIndex = 0;
const taskToAnswers = {};
const taskToCourses = {};
let taskToText = {};
let allTasks = '';
let allTests = '';
let sameResponses = '';


socket.on('connected-user',()=>{
    //username == 'hughes@mail.saitama-u.ac.jp' && socket.emit('get-test-titles');
    //username != 'hughes@mail.saitama-u.ac.jp' && socket.emit('get-tests-to-check');
    socket.emit('get-test-titles');
    
});

socket.on('got-users',data=>{
    $('#assign-check-menu').remove();
    console.log('got-users',data);
    users = data.users;
    socket.emit('get-tests-to-check');
});

// socket.on('got-task-titles',data=>{
//     console.log('got-task-titles',data);
//     const {titles} = data;

// })


function getUsers(){
    socket.emit('get-users');
}


function createAssignCheckMenu(titles){
    const div = elem.as('div#assign-check-menu').to($('#content')[0]);
    elem.as([
        div,
        'table',
        'tr',
        'td',
        {
            select:{
                id:'add-remove-test-to-check'
            }
        },
        1,
        ...titles.map(t=>{
            const {title,_id} = t;
            return {
                option:{
                    innerHTML:title,
                    value:_id
                }
            };
        }),
        'td',
        {
            button:{
                innerHTML:'Add',
                onclick:function(){
                    console.log('add-test-to-check',{
                        task:$('#add-remove-test-to-check').val()
                    });
                    socket.emit('add-test-to-check',{
                        task:$('#add-remove-test-to-check').val()
                    });
                }
            }
        },
        'td',
        {
            button:{
                innerHTML:'Remove',
                onclick:function(){
                    socket.emit('remove-test-to-check',{
                        task:$('#add-remove-test-to-check').val()
                    });
                }             
            }
        }
    ]).to($('#content')[0]);
    elem.as('div',{
        button:{
            innerHTML:'Done',
            onclick:function(){
                console.log('Done');
                $(div).find('button').attr('disabled',true);
                getUsers();
            }
        }
    }).to(div);

    elem.as('hr').to(div);
    elem.as('div#current-tests-to-check').to(div);
    elem.as('hr').to(div);
    socket.emit('get-current-tests-to-check');
}

socket.on('got-current-tests-to-check',data=>{
    console.log('got-current-tests-to-check',data);
    const {tests} = data;
    const div = $('#current-tests-to-check')[0];
    elem.clear(div);
    elem.as([
        'div',
        ...tests.map(t=>`div>${t.title}`)
    ]).to(div);
});

function showLoadingProgressBar(){
    let div = $('#tests-to-check').length ? $('#tests-to-check')[0] : elem.as('div#tests-to-check').to($('#content')[0]);
    elem.clear(div);
    elem.as(
        'div',
        'p>Loading...',
        {
            div:{
                style:{
                    position:'relative',
                    height:'10px',
                    width:'400px',
                    backgroundColor:'#ddd'

                }
            },
       },
       1,
       {
           div:{
               id:'progress-indicator',
               style:{
                   position:'absolute',
                   left:0,
                   top:0,
                   height:'10px',
                   backgroundColor:'green',
                   display:'block'

               }
           }
       }
    ).to(div);
}

function getPercentCheckedForTask(task){
    const answers = taskToAnswers[task];
    if(!answers || !answers.length){
        return '(no responses yet)';
    }
    console.log('getPercentCheckedForTask',{task,answers});
    return Math.floor(100*answers.filter(a=>a.checked).length/answers.length);
}

function showTestsToCheck(tests){
    console.log('showTestsToCheck',tests);
    let div = $('#tests-to-check').length ? $('#tests-to-check')[0] : elem.as('div#tests-to-check').to($('#content')[0]);
    elem.clear(div);
    elem.as([
        'table',
        ...tests.reduce((els,t)=>{
            const {title,task} = t;
            const percentChecked = getPercentCheckedForTask(task);
            els.push(...[
                'tr',
                {
                    td:{
                        style:{
                            whiteSpace:'nowrap'
                        }
                    }
                },

                {
                    input:{
                        type:'radio',
                        value:task,
                        name:'test-to-check',
                        id:'radio-'+task,
                        style:{
                            marginRight:'10px'
                        },
                        onclick:function(){
                            const task = $(this).val();
                            //console.log('get-test-to-check',{task});
                            //socket.emit('get-test-to-check',{task});
                            const text = taskToText[task];
                            const answers = taskToAnswers[task];
                            showTest({task,text,answers});
                        }
                    }
                },
                {
                    label:{
                        htmlFor:'radio-'+task,
                        innerHTML:title
                    }
                },
                //`td>${percentChecked}%`
                {
                    td:{
                        innerHTML:percentChecked+'%',
                        id:`percent-checked-${task}`,
                        style:{
                            whiteSpace:'nowrap'
                        }
                    }
                }
            ]);
            return els;
        },[])
    ]).to(div);

    elem.as('hr').to(div);

}

function highlightAndFocusOnInput(el){
    console.log('highlightAndFocusOnInput',el);
    $(el).find('input')[0].focus();
    const originalBackgroundColor = $(el).css('background-color');
    el.style.backgroundColor='yellow';
    setTimeout(function(){
        el.style.backgroundColor = '';
    },750);

}

function updateCheckButton(task,index){
    console.log('updateCheckButton',task);
    let completeCount = 0;
    $('.trans-score').each(function(){
        console.log('this.dataset.complete',this.dataset.complete);
        completeCount+=parseFloat(this.dataset.complete);
    });
    
    const percentChecked = Math.floor(100 * completeCount/$('.trans-score').length);
    console.log({completeCount,percentChecked});
    const elId = `#check-button-${task}-${index-.1}`;
    console.log(elId);
    $(elId)[0].innerHTML = `[${percentChecked}%]`;
    if(completeCount==$('.trans-score').length){
        $(elId).css('background-color','green');
    }
}

const gradeRowComplete = {};
const gradeRowPoints = {};

function getGradingRow(task,answer,i){
    const min = 0;
    const max = 2;
    const {_ids,index,response,checked} = answer;
    let {points} = answer;
    const elId = `trans-score-${task}-${index-.1}-${i}`;
    points = gradeRowPoints[elId] ? gradeRowPoints[elId].points : points;
    return [
        {
            tr:{
                onclick:function(){
                    $(this).find('input')[0].focus();
                }
            }
        },
        `td.response>${response ? response : '___'}`,
        'td',
        {
            input:{
                className:'trans-score',
                id:elId,
                type:'range',
                value:points!==undefined ? points : 1,
                min,
                max,
                callback:function(el){
                    el.dataset.complete = 0;  
                    function markCompleted(){
                        console.log('markCompleted',!parseFloat(el.dataset.complete),el.dataset.complete);
                        if(!parseFloat(el.dataset.complete)){
                            el.dataset.complete = 1;
                            if(!checked && !gradeRowComplete[el.id]){
                                incrementPercentChecked(task,_ids.length);
                                updateCheckButton(task,index);
                            }
                            gradeRowComplete[el.id] = 1;
                        }
                        
                        el.style.opacity = 1;
                        points = parseFloat($(el).val());
                        gradeRowPoints[el.id] = {points};
                        console.log('score-trans',{
                            _ids,
                            index,
                            points,
                            task
                        });
                        socket.emit('score-trans',{
                            _ids,
                            index,
                            points:parseFloat($(el).val()),
                            task
                        });
                    }
                    function next(){
                        console.log('next');
                        let nextEl = '';
                        $('.trans-score').each(function(index){
                            console.log(this,el,this==el);
                            if(this==el){
                                nextEl = $('.trans-score')[index+1];
                            }
                        });
                        if(!nextEl){
                            nextEl = $('.trans-score')[0];
                        }
                        highlightAndFocusOnInput($(nextEl).parent().parent()[0]);
                    }
                    $(el).on('keydown',function(event){
                        const {key} = event;
                        if(key=='Enter'){
                            if(key=='Enter'){
                                markCompleted();
                            }
                            next();
                            return;
                        }
                        if(isNaN(key)){
                            return;
                        }
                        const num = parseFloat(key);
                        if(num <= max && num >= min){
                            el.value = num;
                            markCompleted();
                        }                       
                    });
                    $(el).on('change',function(){
                        markCompleted();
                    });
                    $(el).on('click',function(){
                        markCompleted();
                    });
                    (checked || gradeRowComplete[el.id]) && markCompleted();
                },
                style:{
                    opacity:.2
                }
            }
        }
    ]
}

function getTransList(task,transItem,answers){
    console.log({transItem,answers});
    answers = answers.reduce((ans,a)=>{
        const {_id,response,index,points,checked} = a;
        if(!ans.find(n=>n.response==a.response)){
            ans.push({
                _ids:answers.filter(n=>n.response==a.response).map(n=>n._id),
                response,
                index,
                checked,
                points
            });
        }
        return ans;
    },[]);

    console.log('getTransList answers',answers);

    const span = elem.as({
        span:{
            style:{
                position:'relative',
                display:'inline-block'
            }
        }
    });
    return elem.as([
        span,
        {
            button:{
                id:`check-button-${task}-${transItem.index-.1}`,
                className:'check-button',
                innerHTML:`[${Math.floor(100*answers.filter(a=>a.checked).length/answers.length)}%]`,
                style:{
                    color: 'white',
                    backgroundColor:answers.filter(a=>a.checked).length == answers.length ? 'green' : 'orange',
                    border:'none'
                },
                onclick:function(){
                    $('button').attr('disabled',false);
                    $('.check-trans').length && $('.check-trans').remove();
                    setTimeout(function(){
                        this.disabled = true;
                        const rect = span.getBoundingClientRect();
                        const originalSpanWidth = rect.width;
                        let lastClickedDiv = new Date().getTime();
                        function removeWhenClickedOff(){
                            if(new Date().getTime()-lastClickedDiv > 50){
                                window.removeEventListener('click',removeWhenClickedOff);
                                $('.check-trans').remove();
                                span.style.width = '';//originalSpanWidth+'px';
                                $('button').attr('disabled',false);
                            }
                        }
                        const listEls = [
                            {
                                div:{
                                    className:'check-trans',
                                    style:{
                                        position:'absolute',
                                        left:0,
                                        top:0,
                                        zIndex:999999,
                                        backgroundColor:$('body').css('background-color'),
                                        border:'1px solid gray',
                                        padding:'8px 8px 8px 8px'
                                    },
                                    callback:function(el){
                                        function adjust(){
                                            if(!$('.check-trans').length){
                                                setTimeout(adjust,500);
                                                return;
                                            }
                                            const {height,width} = el.getBoundingClientRect();
                                            span.style.width = width+'px';
                                            el.style.top =( height/2 * -1)+'px';
                                            window.addEventListener('click',removeWhenClickedOff);
                                            $(el).on('mouseover',function(){
                                                this.style.opacity=1;
                                            });
                                            $(el).on('mouseout',function(){
                                                this.style.opacity=.3;
                                            });
                                            
                                        }
                                        adjust();
    
                                        
                                        
                                    },
                                    onclick:function(){
                                        lastClickedDiv = new Date().getTime();
                                    }
    
                                }
                            },
                            'table',
                            ...answers.reduce((ans,a,i)=>{
                                ans.push(...getGradingRow(task,a,i));
                                return ans;
                            },[])
                        ];
                        console.log(listEls);
                        elem.as(listEls).to(span);
                        setTimeout(function(){
                            if(!$('.trans-score').length){
                                return;
                            }
                            let incomplete = $('.trans-score')[0];
                            $('.trans-score').each(function(){
                                if(!parseFloat(this.dataset.complete)){
                                    incomplete = this;
                                    return false;
                                }
                            });
                            console.log('incomplete',incomplete);
                            highlightAndFocusOnInput($(incomplete).parent().parent()[0]);
                        },500);
                    },300);
                }
            }
        }
    ]);
}

const taskToCheckedStats = {};


function updateCheckedPercent(task){
    $(`#percent-checked-${task}`).html(taskToCheckedStats[task].percentChecked+'%');
}

function incrementPercentChecked(task,len){
    taskToCheckedStats[task].checkedCount+=len;
    taskToCheckedStats[task].percentChecked = Math.round(100*taskToCheckedStats[task].checkedCount/taskToCheckedStats[task].count);
    updateCheckedPercent(task);
}

function updateTaskToCheckedStats(task,answers){
    taskToCheckedStats[task] = {
        count:answers.length,
        checkedCount:answers.filter(a=>a.checked).length,
        
    }
    taskToCheckedStats[task].percentChecked = Math.round(100* taskToCheckedStats[task].checkedCount/ taskToCheckedStats[task].count);
}


function showTest(data){
    const {task,text,answers} = data;
    if(!answers){
        showMessage('No one has taken this test yet, so there are no responses to check. Please try back later.');
        return;
    }
    updateTaskToCheckedStats(task,answers);
    const testContainer = $('#test-container').length ? $('#test-container')[0] : elem.as('div#test-container').to($('#content')[0]);
    elem.clear(testContainer);
    elem.as(
        'div',
        'div#check-test',
        {
            div:{
                id:'testQuill',
                style:{
                    display:'none'
                },
                callback:function(el){
                    console.log('el.id',el.id);
                    const testQuill = loadQuillOutput('testQuill','check-test',text,function(el,word,index){return;});
                    $('.ql-toolbar').remove();
                    $('.w').each(function(){
                        const index = this.dataset.index;
                        //const item = items.find(i=>i.index==index);
                        const transItem = answers.find(i=>i.index-.1 == index);
                        //if(item){
                            //console.log('found',index);
                            //this.innerHTML = item.word;
                            if(transItem){
                                $(this).addClass('trans-word');
                                $(this).after(getTransList(task,transItem,answers.filter(a=>a.index-.1==index)));
                                this.onclick = function(){
                                    $(`#check-button-${task}-${transItem.index-.1}`).trigger('click');
                                }
                            }
                        //}
                    });
                }
            }
        }
    ).to(testContainer);



}



socket.on('got-test-titles',data=>{
    console.log('got-test-titles',data);
    const {titles} = data;
    titles.forEach(t=>{
        const {_id,courses} = t;
        taskToCourses[_id] = courses;
    });
    if(username=='hughes@mail.saitama-u.ac.jp'){
        createAssignCheckMenu(titles);
        return;
    }
    getUsers();

});


const loadingStages = {
    'scored-trans-no-reponse':{index:0,items:1,width:5},
    'got-answers-by-username-task':{index:0,items:-1,width:85},
    'got-text-for-task':{index:0,items:-1,width:5},
    'scored-same-responses':{index:0,items:-1,width:5}
};

function addItemCountToLoadingStage(stage,itemCount){
    console.log('addItemCountToLoadingStage',stage,itemCount);
    loadingStages[stage].items = itemCount;
    loadingStages[stage].index=0;
}

function incrementLoadingStageIndex(stage){
    loadingStages[stage].index++;
}

function updateProgressBar(){
    const progressCount = Object.keys(loadingStages).reduce((count,key)=>{
        const {index,items,width} = loadingStages[key];
        if(!items || items==-1){
            return count;
        }
        count+=index*width/items;
        return count;
    },0);
    $('#progress-indicator').css('width',`${progressCount}%`);

}



socket.on('got-tests-to-check',data=>{
    allTests = data.tests;
    console.log({allTests});
    showLoadingProgressBar();
    const courseToTasks = allTests.reduce((ob,t)=>{
        const courses = taskToCourses[t.task];
        courses.forEach(c=>{
            ob[c]=ob[c]?ob[c]:[];
            ob[c].push(t.task);
        });
        return ob;
    },{});
  //  console.log('got-tests-to-check coursesToTasks',courseToTasks);
    for(let i=0,l=users.length;i<l;i++){
        const {course} = users[i];
        users[i].tasks = courseToTasks[course] ? courseToTasks[course] : [];
    }
    socket.emit('score-trans-no-response');
},{});

function updateAnswerScores(data){
    const {_ids,task,points} = data;
    for(let i=0,l=taskToAnswers[task].length;i<l;i++){
        if(_ids.includes(taskToAnswers[task][i]._id)){
            taskToAnswers[task][i].points = points;
            taskToAnswers[task][i].checked = true;
        }
    }
}

socket.on('scored-trans',data=>{
    updateAnswerScores(data);
});

socket.on('scored-trans-no-reponse',data=>{
    incrementLoadingStageIndex('scored-trans-no-reponse');
    updateProgressBar();

    addItemCountToLoadingStage('got-answers-by-username-task',users.reduce((count,u)=>{
        const {tasks} = u;

        count+=u.tasks.length;
        return count;
    },0));
    getAnswers();
    
});

function getAnswers(){
    if(!users[userIndex]){
        return;
    }
    const {tasks,username} = users[userIndex];
    const task = tasks[taskIndex];
    socket.emit('get-answers-by-username-task',{
        username,
        task
    });
}


socket.on('got-answers-by-username-task',data=>{
    incrementLoadingStageIndex('got-answers-by-username-task');
    updateProgressBar();
    const {answers,task} = data;//username
    if(task){
        taskToAnswers[task] = taskToAnswers[task] ? taskToAnswers[task] : [];
        answers.length && taskToAnswers[task].push(...answers);
    }
    if(users[userIndex].tasks[taskIndex+1]){
        taskIndex++;
    }
    else if(users[userIndex+1]){
        taskIndex=0;
        userIndex++;
    } 
    else{
        addItemCountToLoadingStage('got-text-for-task',Object.keys(taskToAnswers).length);
        getTextsForTasks();
        return;
    } 
    setTimeout(getAnswers,10);
});


let textForTaskIndex = 0;

function getTextsForTasks(){
    allTasks = Object.keys(taskToAnswers);
    getTextForTask();
}

function getTextForTask(){
    const task = allTasks[textForTaskIndex];
    socket.emit('get-text-for-task',{task});
}

socket.on('got-text-for-task',data=>{
    incrementLoadingStageIndex('got-text-for-task');
    updateProgressBar();
    const {task,text} = data;
    taskToText[task] = text;
    if(allTasks[textForTaskIndex+1]){
        textForTaskIndex++;
        setTimeout(getTextForTask,10);
        return;
    }
    autoScoreSameResponses();

});


function autoScoreSameResponses(){
    const sameResponseOb = {};
    for(let task in taskToAnswers){
        const alreadyChecked = {};
        const answers = taskToAnswers[task];
        for(let i=0,l=answers.length;i<l;i++){
            const answer = answers[i];
            const {_id,response,index,points,checked} = answer;
            if(!checked){
                continue;
            }
            alreadyChecked[index] = alreadyChecked[index] ? alreadyChecked[index] : {};
            alreadyChecked[index][response] = alreadyChecked[index][response] ? alreadyChecked[index][response] : {points};
        }
        for(let i=0,l=answers.length;i<l;i++){
            const answer = answers[i];
            const {_id,response,index,checked} = answer;
            if(checked){
                continue;
            }
            if(!alreadyChecked[index]){
                continue;
            }
            if(!alreadyChecked[index][response]){
                continue;
            }
            const {points} = alreadyChecked[index][response];
            const taskIndexResponse = `${task}_${index}_${response}`;
            sameResponseOb[taskIndexResponse] = sameResponseOb[taskIndexResponse] ? sameResponseOb[taskIndexResponse] : {index,points,_ids:[]};
            sameResponseOb[taskIndexResponse]._ids.push(_id);

            taskToAnswers[task][i].checked = true;
            taskToAnswers[task][i].points = points;
        }
    }
    sameResponses = Object.values(sameResponseOb);
    console.log('sameResponseOb',sameResponseOb);
    addItemCountToLoadingStage('scored-same-responses',sameResponses.length);
    scoreSameResponses();
}

let sameResponseIndex = 0;

function scoreSameResponses(){
    if(!sameResponses[sameResponseIndex]){
        showTestsToCheck(allTests);
        return;
    }
    socket.emit('score-same-responses',sameResponses[sameResponseIndex]);
    sameResponseIndex++;
}

socket.on('scored-same-responses',data=>{
    incrementLoadingStageIndex('scored-same-responses');
    updateProgressBar();
    setTimeout(scoreSameResponses,10);
});



// socket.on('got-test-to-check',data=>{
//     console.log('got-test-to-check',data);
//     showTest(data);
// });