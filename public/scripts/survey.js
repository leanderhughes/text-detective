
    function toggleLocked(button,id=false){
        const locked = button.innerHTML=='Lock' ? true : false;
        button.innerHTML= locked ? 'Unlock' : 'Lock';
        id && socket.emit('survey-toggle-locked',{
          id,
          locked
        });
        
      }
  
      function togglePublished(button,id=false){
        const published = button.innerHTML=='Publish' ? true : false;
        button.innerHTML = published ? 'Unpublish' : 'Publish';
        console.log('togglePublished',{
            id,
            published
          });
        socket.emit('survey-toggle-published',{
          id,
          published
        });
      }
      
  
      function getResponseIndex(el){
        let index = 0;
        let responseIndex=-1;
        $('.response').each(function(){
          if(el==this){
            responseIndex = index;
          }
          index++;
        });
        return responseIndex;
      }
  
      function getResponseElement(inputElement){
        if($(inputElement).hasClass('response')){
            return inputElement;
        }
        return $(inputElement).closest('.response')[0];
      }
  
      function getResponseIndexFromInputElement(inputElement){
        return getResponseIndex(getResponseElement(inputElement));
      }
  
      let currentItems = [];
      let currentResponses = [];
  
      function getCurrentItem(inputElement){
        const responseElement = getResponseElement(inputElement);
        const responseIndex = getResponseIndex(responseElement);
        const item = currentItems[responseIndex];
        return item;
      }
  
      function parseInputString(inputElement){
        let string = inputElement.innerText ? inputElement.innerText : inputElement.value;
        if(!string){
          return string;
        }
        string = string.trim();
        if(!string){
          return string;
        }
        if(!isNaN(string)){
          return parseFloat(string);
        }
        return string;
      }
  
      var enterTextTimeout = '';
  
      function enterText(el){
        enterTextTimeout && clearTimeout(enterTextTimeout);
        submitResponse(el);
      }
  
  
      function enterTextSoon(el){
        enterTextTimeout && clearTimeout(enterTextTimeout);
        enterTextTimeout = setTimeout(function(){
          enterText(el);
        },5000);
      }
  
      function submitResponse(inputElement){
        const itemIndex = getResponseIndexFromInputElement(inputElement);
        const responseValue =  parseInputString(inputElement);
        const item = currentItems[itemIndex];
        (inputElement.value && !isNaN(inputElement.value) || (inputElement.value && inputElement.value.trim()) ) || (inputElement.innerText && inputElement.innerText.trim()) ? $(inputElement).addClass('complete') : $(inputElement).removeClass('complete');
        if(currentResponses[itemIndex]==responseValue){
          return;
        }
        currentResponses[itemIndex]=responseValue;
        console.log({itemIndex,responseValue,item});
        socket.emit('submit-response',{
          id:$('#survey-id').val(),
          itemIndex,
          responseValue
        });
      }
  
  
      function selectOne(el){
        console.log('selectOne',el);
        $(el).parent().find('.selected').removeClass('selected');
        $(el).addClass('selected');
        submitResponse(el);
      }
  



    function fillInResponse(el,response){
        // console.log('fillInResponse',el,'el.contentEditable',el.contentEditable,'response',response,JSON.stringify(response));
        console.log('fill in',response);
        if($(el).attr('contenteditable')=='true'){
            console.log('contentEditable el.innerHTML=',response,el);
            el.innerHTML = response.replace(/\n{1,}/g,'\n\n');
            console.log(el);
            return;
        }
        if($(el).find('td').length){
            console.log('has td',el);
            $(el).find('td').each(function(){
                console.log(this.innerText,parseInputString(this),response);
                if(parseInputString(this)==response){
                    $(el).find('.selected').removeClass('selected');
                    $(this).addClass('selected');
                    $(this).addClass('complete');
                }
            });
            return;
        }
        if(response && !isNaN(response) || response.trim()){
            $(el).val(response);
            $(this).addClass('complete');
        }
        else{
            $(this).removeClass('complete')
        }
        
        //console.log('other',el,$(el).attr('contenteditable'));
    }

    function submitSurvey(){
        $('.response').each(function(){
            if($(this).attr('contenteditable')=='true'){
                if(!this.innerText || !this.innerText.trim()){
                    $(this).addClass('incomplete');
                }
            }
            if($(this).find('td').length && !$(this).find('.selected').length){
                $(this).addClass('incomplete');
            }
        });
        if($('.incomplete').length){
            $('.incomplete')[0].scrollIntoView({behavior:'smooth',block:'center'});
            $('.incomplete').on('click',function(){
                $(this).removeClass('incomplete');
            });
            showMessage("Please fill in the missing information before submitting.");
            return;
        }
        showMessage([
            "p>Are you sure you want to submit? You will not be able to make changes after submitting.",
            {
                button:{
                    innerHTML:'Submit',
                    onclick:function(){
                        socket.emit('submit-survey',{
                            id:$('#survey-id').val()
                        });
                        closeMessage();
                    }
                }
            },
            {
                button:{
                    innerHTML:'Cancel',
                    onclick:function(){
                        closeMessage();
                    }
                }
            }
        ]);
    }

    socket.on('survey-complete',()=>{
        showMessage("Survey complete!",function(){
            window.location.href = '../surveys';
        });
    });

    function convertDate(date) {
        var yyyy = date.getFullYear().toString();
        var mm = (date.getMonth()+1).toString();
        var dd  = date.getDate().toString();
        
        var mmChars = mm.split('');
        var ddChars = dd.split('');
        
        return yyyy + '-' + (mmChars[1]?mm:"0"+mmChars[0]) + '-' + (ddChars[1]?dd:"0"+ddChars[0]);
        
    }
      

    socket.on('got-survey',data=>{
        const {id,survey,title,markUp,html,items,responses,locked,published,complete,isTeacher} = data;
        currentSurveyId = id;
        console.log('got-survey',{id,title,markUp,html,items,responses,locked,published,complete,isTeacher});
        isTeacher && $('#editor').find('.ql-editor').html(markUp);
        const toggleLocked = !isTeacher ? '' : `<button class="link-button" onclick="toggleLocked(this,'${survey}')">${locked ? 'Unlock' : 'Lock'}</button>`;
        const togglePublished = !isTeacher ? '' : `<button class="link-button" onclick="togglePublished(this,'${survey}')">${published ? 'Unpublish' : 'Publish'}</button>`;
        
        const innerHTML = `
        <input type="hidden" id="survey-id" value="${id}">
            <h1>${title} ${complete ? '<span style="color:green">[Complete]</span>' : ''}</h1>
            <div>
            ${togglePublished}

            ${toggleLocked}
            </div>



            <div>${html}</div>

            ${complete ? '' : '<button onclick="submitSurvey()">Submit Survey</button>'}
        `;
        
        
        $('#current-survey')[0].innerHTML = innerHTML;

        $('input.date-today').each(function(){
            $(this).val(convertDate(new Date()));
        });

        $('.response').each(function(index){
            responses[index]!==null && responses[index]!==undefined && fillInResponse(this,responses[index]);
            if(complete){
                $(this).attr('contenteditable',false);
                $(this).find('td').each(function(){
                    this.onclick = function(){
                        return false;
                    }
                });
                $(this).attr('disabled',true);
                this.onclick = function(){
                    showMessage("You have already completed this survey, so no changes can be made.");
                }
            }
        });

    });

    socket.on('got-surveys',data=>{
        const {surveys,isTeacher} = data;
        console.log('got-surveys',data);
        if(!surveys.length){
        $('#surveys').html('(No surveys available currently)');
            return;
        }
        console.log('surveys',surveys.map(s=>s.title));
        surveys.reverse();
        console.log('surveys',surveys.map(s=>s.title));
        //surveys.sort(function(a,b){return (a.title=='説　明　書・同　意　書' ? -1 : 1)-(b.title=='説　明　書・同　意　書' ? -1 : 1);});
        surveys.forEach(s=>{
            const {_id,title,locked,published,complete} = s;
            const id = _id;

            const toggleButtons = isTeacher ? `        
            <button class="link-button" onclick="togglePublished(this,'${id}')">${published ? 'Unpublish' : 'Publish'}</button>        
            <button class="link-button" onclick="toggleLocked(this,'${id}')">${locked ? 'Unlock' : 'Lock'}</button>  
            ` : '';

            $('#survey-links').prepend(

                ` 
                <p>
                    
                    <a style="margin-right:20px" href="${rootPath}/surveys/${title}">${title}</a> ${toggleButtons} ${complete ? '(complete)' : ''}
                    
                
                </p>

                `

            );
        })
    });

    $('#editor').on('keyup',function(){
        localStorage.setItem('survey-draft',JSON.stringify(quill.getContents()));
    });

    $('#survey-title').on('keyup',function(){
        localStorage.setItem('survey-title',$('#survey-title').val());
    });


    socket.emit('survey-test');

    function getDefaultValueString(delimiter){
        return delimiter.indexOf('default:')>-1 ? delimiter.slice(delimiter.indexOf('default:')+'default:'.length,-1) : ''
    }

    class GetFormatParams{
        constructor(){

        }
        likert(string){
            const infoArray = string.split(',').map(s=>s.trim());
            const low = infoArray[0];
            const high = infoArray[2];
            const valueString = infoArray[1];
            const delimiter = valueString;
            const values = valueString.indexOf('-')>-1 ? valueString.split('-') : valueString.split('');
            return {
                type:'likert',
                low,
                high,
                values,
                delimiter
            }
        }
        openText(string){
            return {
                type:'openText',
                delimiter:string.trim()
            }
        }
        checkOne(string){
            string = string.trim();
            return {
                type:'checkOne',
                options:string.split(',').map(s=>s.trim()),
                delimiter:string,
                values: string.slice(1,-1).split(',').map(s=>s.trim())
            }
        }
        openDate(string){
            string = string.trim();
            const val = string.slice(1,-1).toLowerCase();
            const defaultDateToday = [`date today`,`today's date`].includes(val) ? 'date-today' : '';
            const otherDefault = !defaultDateToday && val.split('-').length==3 ? val : '';
            const defaultValue = defaultDateToday || otherDefault;
            return {
                type:'openDate',
                delimiter:string,
                defaultValue 
            }
        }
        openWord(string){
            const delimiter = string.trim();
            const defaultValue = getDefaultValueString(delimiter);
            return {
                type:'openWord',
                delimiter,
                defaultValue
            }
        }
        openName(string){
            const delimiter = string.trim();
            const defaultValue = getDefaultValueString(delimiter);
            return {
                type:'openName',
                delimiter,
                defaultValue
            }
        }
        openNumber(string){
            const delimiter = string.trim();
            const defaultValue = getDefaultValueString(delimiter);
            return {
                type:'openNumber',
                delimiter,
                defaultValue
            }
        }
        openSign(string){
            const delimiter = string.trim();
            const defaultValue = getDefaultValueString(delimiter);
            return {
                type:'openSign',
                delimiter,
                defaultValue
            }
        }

    }
    const getFormatParams = new GetFormatParams();

    class Format{
        constructor(){


        }
        likert(html,params){
            const {delimiter,high,low,values} = params;
            html = html.split(delimiter).join(`
            <div class="response likert">      
                <div class="likert-labels"><span class="likert-low-end">${low}</span><span class="likert-high-end">${high}</span></div>
                <div> 
                <table>
                    <tr class="likert-values">
                    ${'<td onclick="selectOne(this)">'+values.join('</td><td onclick="selectOne(this)">')+'</td>'}
                    </tr>
                </table>
                </div>                      
            </div>

            
            `);
            return html;
        }
        checkOne(html,params){
            // [Format: Check-One: (yes, no)]
            // Did this work? (yes, no)
            const {delimiter,values} = params;
            const width = values.reduce((max,v)=>{
                if(v.length>max){
                max=v.length;
                }
                return max;
            },0)*8;
            html = html.split(delimiter).join(`
            <div class="response checkOne">      
                <div> 
                <table class="short" style="width:${(width*values.length<$('body').width() ? width*values.length : '100%')}px">
                    <tr class="likert-values">
                    ${'<td onclick="selectOne(this)"><span style="width:100%">'+values.join('</span></td><td onclick="selectOne(this)"><span style="width:100%">')+'</span></td>'}
                    </tr>
                </table>
                </div>                      
            </div>

            
            `);
            return html;                                   
        }
        openText(html,params){
            const {delimiter} = params;
            return html.split(delimiter).join(`
                <div class="response openText" contentEditable="true" onkeyup="enterTextSoon(this)" onblur="enterText(this)">      
                
                </div>         
            `);
        }
        openWord(html,params){
            const {delimiter,defaultValue} = params;
            return html.split(delimiter).join(`
                <input class="response" type="text" onkeyup="enterTextSoon(this)" onblur="enterText(this)" value="${defaultValue}">
            `);
        }
        openName(html,params){

            const {delimiter} = params;
            return html.split(delimiter).join(`
                <input class="response" type="name" onkeyup="enterTextSoon(this)" onblur="enterText(this)">
            `);
        }
        openNumber(html,params){

            const {delimiter} = params;
            return html.split(delimiter).join(`
                <input class="response" type="number" onkeyup="enterTextSoon(this)" onblur="enterText(this)">
            `);
        }
        openSign(html,params){
            // [Format: Open-Sign: (open-sign)]
            // Sign Here (open-sign)

            const {delimiter} = params;
            return html.split(delimiter).join(`
                <input class="response open-sign" type="name" onkeyup="enterTextSoon(this)" onblur="enterText(this)">
            `);
        }
        openDate(html,params){
            // [Format: Open-Date: (date today)]
            // The Date Today  
            // (date today)
            console.log('openDate',html,params);
            const {delimiter,defaultValue} = params;
            const dateTodayClass = defaultValue =='date-today' ? ' date-today' : '';
            const value = defaultValue!='date-today' ? defaultValue : '';
            return html.split(delimiter).join(`

                <input type="date" class="response${dateTodayClass}" value="${value}" onkeyup="enterTextSoon(this)" onblur="enterText(this)">

            `);
        }
    }

    const format = new Format();

    function parseFormat(string){
        string = string.trim();
        const colonIndex = string.indexOf(':');
        const formatType = string.slice(0,colonIndex).toLowerCase().split('-').reduce((string,item,index)=>{
            if(!index){
                string=item;
                return string;
            }
            string=string+item[0].toUpperCase()+item.slice(1);
            return string;
        },'');
        const formatInfoString = string.slice(colonIndex+1);
        return getFormatParams[formatType](formatInfoString);
    }

    function formatSurvey(html,text){
        let parts = html.split('[Format:');
        let items = text.split('[Format:');
        items.shift();
        items = items.map(i=>i.slice(i.indexOf(']')+1));
        const head = parts.shift();
        parts = parts.map(h=>{
           const close = h.indexOf(']');
            return {
                format:parseFormat(h.slice(0,close)),
                html:h.slice(close+1)
            }
        });

        items = items.reduce((is,item,i)=>{
            const {delimiter} = parts[i].format;
            item = item.split(delimiter).map(it=>it.trim());
            item.pop();
            is.push(...item);
            return is;
        },[]);

        parts = parts.map(p=>{
            return format[p.format.type](p.html,p.format);
        });
        // const lastPart = parts[parts.length-1];
        // console.log(lastPart.format.delimiter);
        // const finalDelimiter = lastPart.html.indexOf(lastPart.format.delimiter)+lastPart.format.delimiter.length;
        // const tail = lastPart.html.slice(finalDelimiter);
        // parts[parts.length-1].html = parts[parts.length-1].html.slice(0,finalDelimiter);
    
        console.log(parts);
        console.log(items);


        return {
            html:head+parts.join(''),
            items
        };
    }


    function saveSurvey(){
        console.log('save-survey');
        const ql = $('#editor').find('.ql-editor')[0];
        const title = $('#survey-title').val().trim();
        console.log('stuff',$('#create-edit-survey button.toggle-published').text(),$('#create-edit-survey button.toggle-locked'));
        const published = $('#create-edit-survey button.toggle-published').text()=='Unpublish';
        const locked = $('#create-edit-survey button.toggle-locked').text()=='Unlock';
        const markUp = ql.innerHTML;
        const {html,items} = formatSurvey(ql.innerHTML,ql.innerText);
        console.log('saveSurvey',{title,markUp,html,items,published,locked});    
        socket.emit('save-survey',{title,markUp,html,items,published,locked});
    }

    $('#save-survey').on('click',saveSurvey);

    socket.on('saved-survey',data=>{
        timeoutMessage('Survey saved.');
        !titleParameter && socket.emit('get-surveys');
        socket.emit('get-survey',{title:data.title});
    });

    // function surveySocketLogin(){
    //     console.log('survey-socket-login',{token});
    //     console.log('time',new Date());
    //     socket.emit('survey-socket-login',{token});
    //     token = '';
    // }
    // surveySocketLogin();

    // socket.on('reload-surveys',()=>{
    //     console.log('reload');
    //     window.location.reload();
    // });


    socket.on('survey-overwrite-request',data=>{
        showMessage([
        `p>A survey with the title "${data.title}" already exists. Would you like to overwrite it?`,
        {
        button:{
            innerHTML:'Yes, overwrite it.',
            onclick:function(){
            data.overwrite = true;
            socket.emit('save-survey',data);
            closeMessage();
            }
        }
        },
        {
        button:{
            innerHTML:'Cancel',
            onclick:function(){
            closeMessage();
            }
        }
        }
        ]);
    });

    // socket.on('survey-login-complete',()=>{
    //     console.log('survey-login-complete','titleParameter',titleParameter);
    //     titleParameter  && socket.emit('get-survey',{title:titleParameter});
    //     !titleParameter && socket.emit('get-surveys');
    // });

    socket.on('connected-user',()=>{
        titleParameter  && socket.emit('get-survey',{title:titleParameter});
        !titleParameter && socket.emit('get-surveys');
    });


