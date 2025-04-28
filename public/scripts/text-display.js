let programmaticallyScrolled = false;
function scrollIntoView(el,options={behavior:'smooth',block:'center'}){
    programmaticallyScrolled = true;
    el.scrollIntoView(options);
}

function highlightSection(from,to,highlightedClassName="highlighted"){
    let begin = false;
    let finish = false;
    $('.reading-passage')[0].querySelectorAll('.w').forEach((w,i,ws)=>{
        if(finish && i==finish+1){
            $(ws[i]).addClass(highlightedClassName);
            return;
        }
        if(finish){
            $(w).removeClass(highlightedClassName);
            return;
        }
        const index = parseFloat(w.dataset.index);
        begin = index==from || begin;
        begin && $(w).addClass(highlightedClassName);
        finish = index==to ? i : finish;
    });
    return true;
}

function highlightSeperateWords(indexes,highlightedClassName="highlighted"){
    $('.reading-passage').find('.w').each(function(){
        indexes.includes($(this).data('index')) && $(this).addClass(highlightedClassName);
    });
    return true;
}

function highlight(fromOrIndexes=false,to=false,highlightedClassName="highlighted"){
    if(fromOrIndexes===false){
        $(`.${highlightedClassName}`).removeClass(highlightedClassName);
        return;
    }   
    if(typeof to == 'string'){
        highlightedClassName = to;
    }
    if(to==false && typeof fromOrIndexes == 'number'){
        return highlight([fromOrIndexes],false,highlightedClassName);
    }
    $(`.${highlightedClassName}`).removeClass(highlightedClassName);
    return to ? highlightSection(fromOrIndexes,to,highlightedClassName) : highlightSeperateWords(fromOrIndexes,highlightedClassName);
}

function highlightAndBlur(fromOrIndexes=false,to=false,highlightedClassName="highlighted"){
    $(`.${highlightedClassName}`).removeClass('blurred-more');
    highlight(fromOrIndexes,to,highlightedClassName);
    $(`.${highlightedClassName}`).addClass('blurred-more');
}

function highlightBlurAndScrollTo(fromOrIndexes=false,to=false,highlightedClassName="highlighted"){
    highlightAndBlur(fromOrIndexes,to,highlightedClassName);
    const i = Array.isArray(fromOrIndexes) ? fromOrIndexes[0] : fromOrIndexes; 
    scrollToWord(i);
}
function scrollToWord(index){
    $('.reading-passage').find('.w').each(function(){
        if($(this).data('index')==index){
            scrollIntoView(this);
        }
    });
    return true;
}

function showWordInfo(el,word,index){
    //get els within selection: https://stackoverflow.com/questions/10202404/get-elements-in-text-selection
    if(word.indexOf('<')>-1){
        word = word.replace(/\<[^\>]{1,100}\>/g,'');
    }
    const context = $(el).parent() && $(el).parent()[0] ? $(el).parent()[0].innerText : false;
    parseFloat(index) && lookupWord(word,index,context);//showInSubWindow(el,[`div>${word} ${index}`]);
    return true;
}

// function setHighlightedCSS(){
//     const backgroundColor = "#ff0";//"#660";
//     elem.as({
//         style:{
//             innerHTML:`
//                 .highlighted {
//                     background-color: ${backgroundColor};
//                 }   
//             `
//         }
//     }).to(document.body); 
// }
// $(function(){
//     setHighlightedCSS();
// });
