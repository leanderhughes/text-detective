//socket.emit('data-socket-login',{token});

socket.on('data-login-complete',()=>{
    console.log('data-login-complete');
});

socket.on('code-executed',data=>{
    //$('#code').html('');
    const {queries, results} = data;
    showMessage(`Got results for: <br><br> ${queries.join('<br>')}<br><br>(See dev console for results)`);
    results.forEach((r,i)=>{
        console.log('Results\n\n',queries[i],'\n\n',r);
    });
});

function autofillUsernameInfo(email){
    if(email.match(/[@\*]/)){
        return email;
    }

    if(email=='hughes'){
        return 'hughes@mail.saitama-u.ac.jp';
    }
    return email+'@ms.saitama-u.ac.jp';
}

function parseDat(string,autofillUsername=false){
    if(!string){
        return string;
    }
    string = string.trim();
    if(!string){
        return string;
    }
    if(string[0]=='{'){
        const data = JSON.parse(string);
        if(autofillUsername && data.username){
            data.username = autofillUsernameInfo(data.username);
        }
        if(autofillUsername && data.email){
            data.email = autofillUsernameInfo(data.email);
        }
        return data;
    }
    if(!isNaN(string)){
        return parseFloat(string);
    }
    if(string=='false'){
        return false;
    }
    if(string=='true'){
        return true;
    }
    return string;
}

function executeCode(){
    console.log('executeCode');
    const string = $('#code')[0].innerText ? $('#code')[0].innerText.trim() : '';
    if(!string){
        showMessage('No code...');
        return;
    }
    const data = string.replace(/\n{1,100}/g,'\n').split('\n').reduce((ob,line,index)=>{

        line = line.trim();
        const firstColon = line.slice(0,line.indexOf('{')).indexOf(':') ;
        const key = firstColon==-1 ? ['model','action','where','set'][index] : line.slice(0,firstColon);
        const val = parseDat(line.slice(firstColon+1),'autofill username info');
        ob[key] = key.toLowerCase()=='model' ? val.replace(/ /g,'').split(',') : val;
        return ob;
    },{});

    console.log('executeCode 2',data);

    socket.emit('execute-code',data);
}

function clearCode(){
    $('#code').html('');
}

$('#executeCode').on('click',executeCode);
$('#clearCode').on('click',clearCode);

