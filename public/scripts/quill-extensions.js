

    function chunkString(string){
        return string.match(/(\w+|[^\w]+)/g)
            .join('|#br#|').split('|#br#|')
            .reduce((items,item)=>{
                item = item ? item.replace(/_/g,'＿') : item;
                if(item.length > 2 && item[0].match(/[\n\.!?]/) && item.slice(-1).match(/[^ a-zA-Z0-9]/)){
                    items.push(item.slice(0,-1));
                    items.push(item.slice(-1));
                    return items;
                }
                items.push(item);
                return items;
        },[]);
    }

    
    function buildDelta(deltaOps){
        const ops = [];
        let i = 0;
        let format = '';
        deltaOps && deltaOps.forEach(op=>{
            if(op.attributes){
                if(op.attributes.color){
                    delete op.attributes.color;
                }
            }
            if(op.format){
                format = op.format == 'to' ? '' : op;
                return;
            }
            if(op.ignore){
                ops.push(op);
                return;
            }
            const newOp = JSON.parse(JSON.stringify({
                insert:op,
                attributes: format ? format.attributes : {}
            }));
            format = format.format == 'next' ? '' : format;
            if(!op.match(/\w/)){
                newOp.attributes.link = '#w_0';
                ops.push(newOp);
                return;
            }
            i++;
            newOp.attributes.link = '#w_'+i;
            ops.push(newOp);
        });
        return {ops:ops};
    }

    function escapeQuotes(op){
        if(!op.insert){
            return op;
        }
        return op.insert.replace(/\"/g,'\"');
    }    
        
    function formatTextLink(a,wordClickFunction){
        const data = a.href.split('_').pop();
        const attributes = {
            'data-index':data,
            target:'',
            nohref:'nohref',
            class:'w'
        };
        Object.keys(attributes).forEach(attribute=>a.setAttribute(attribute,attributes[attribute]));
        a.onclick = function(e){
            e.preventDefault();
            if(!data){
                return;
            }
            wordClickFunction(a,a.innerHTML,data);
        }
    }

    function addAposWordPartData(outputDiv,wordClickFunction){
        const ws = outputDiv.querySelectorAll('a');
        for(let i=0,l=ws.length;i<l;i++){
            if(!ws[i-1] || !ws[i-2]){
                continue;
            }
            if(!ws[i-1].innerHTML.match(/[\'’]/)){
                continue;
            }
            if(!ws[i-2].innerHTML.match(/[a-zA-Z]/) || !ws[i].innerHTML.match(/[a-zA-Z]/)){
                continue;
            }
            const combinedWord = ws[i-2].innerHTML+ws[i-1].innerHTML+ws[i].innerHTML;
            [ws[i-2], ws[i-1], ws[i]].forEach(el=>{
                let index = $(el).data('index');
                if(!index){
                    index = $(ws[i]).data('index');
                }
                el.onclick = function(e){
                    e.preventDefault();
                    wordClickFunction(el,combinedWord,index);
                }
            });
        }
    }

    class QuillExtensions{
        constructor(){

        }
        processQuillInput(delta){
            const ops = [];
            delta.ops && delta.ops.forEach(op=>{
               // op = escapeQuotes(op);
                if(typeof op.insert != 'string'){
                    op.ignore = true;
                    ops.push(op);
                    return;
                }
                if(!op.insert.match(/\w/)){
                    op.attributes && ops.push({
                        ignore:true,
                        format:'next',
                        attributes:op.attributes
                    });
                    ops.push(op.insert);
                    return;
                }
                op.attributes && ops.push({
                    ignore:true,
                    format:'from',
                    attributes:op.attributes
                });
                ops.push(...chunkString(op.insert));
                op.attributes && ops.push({
                    ignore:true,
                    format:'to'
                });
            });
            return ops;
        }
        buildDelta(content){
            return buildDelta(content);
        }
    
        loadQuillOutput(outputQuillId,outputDivId,content,wordClickFunction){
            if(content.length){
                content = buildDelta(content);
                var outputQuill = new Quill('#'+outputQuillId, {
                    theme: 'snow'
                });
                
                outputQuill.once('text-change',function(){
                    const outputDiv = document.getElementById(outputDivId);
                    outputQuill.enable(false);
                    outputDiv.innerHTML = document.getElementById(outputQuillId).getElementsByClassName('ql-editor')[0].innerHTML;
                    outputDiv.querySelectorAll('a').forEach(a=>{
                        if(!a.href.match(/#w_[\d]{1,6}\b/)){
                            return;
                        }
                        formatTextLink(a,wordClickFunction);
                    });
                    addAposWordPartData(outputDiv,wordClickFunction);
                });
                outputQuill.setContents(content);
                
                return outputQuill;
            }
            return false;
        }
        formatQuillText(quillEl,contents,wordClickFunction=()=>{return false}){
            contents = buildDelta(contents);
            quillEl.setContents(contents);
            quillEl.container.querySelectorAll('a').forEach(a=>{
                if(!a.href.match(/#w_[\d]{1,6}\b/)){
                    return;
                }
                $(a).css('color',$('body').css('color'));
                $(a).css('text-decoration','none');

                formatTextLink(a,wordClickFunction);

            });
            addAposWordPartData(quillEl.container,wordClickFunction);
            return true;
        }

        loadEditQuill(editOnClass,editOffClass,editButtonId,editFormId,cancelId,outputQuill){
            const editTextButton = document.getElementById(editButtonId);
            const editTextForm = document.getElementById(editFormId);
            editTextButton.onclick = function(){
                $('.'+editOnClass).show();
                $('.'+editOffClass).hide();
                const ops = (outputQuill.getContents() ? outputQuill.getContents().ops : [])
                .map(op=>{
                    if(op.attributes && op.attributes.link){
                        delete op.attributes.link;
                    }
                    return op;
                });
                outputQuill.setContents({ops});
                outputQuill.enable(true);
                editTextForm.addEventListener('submit',function(e){
                    //e.preventDefault();
                    editTextForm.querySelector('textarea').value = JSON.stringify(processQuillInput(outputQuill.getContents()));//document.getElementsByClassName('ql-editor')[0].innerHTML;
                    return true;//return false;//
                });
            }
            $('#'+cancelId).on('click',function(e){
                e.preventDefault();
                $('.'+editOnClass).hide();
                $('.'+editOffClass).show();
                return false;
            });
            return true;
        }
    
    }

    const quillExtensions = new QuillExtensions();
   
