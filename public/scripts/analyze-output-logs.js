function getGPStats(logString,contentArray){
    //logString must be in "words in line\t1\nnot line\t\nwords in next line\t1\n" format
    logLines = logString.toLowerCase().split('\n').map(l=>l.split('\t'));//.filter(l=>l[1]=='1').map(l=>l[0])
    socket.emit('get-gp-stats',{logLines,contentArray});
    
}

socket.on('got-gp-stats',data=>{
    const {linesWithStats} = data;
    const output = linesWithStats.map(l=>l.join('\t')).join('\n');
    console.log('linesWithStats',output)
});


