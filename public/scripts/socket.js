const socket = io.connect('',{query:'username='+username+'&token='+token});//io('http://localhost:5000')




let taskId = '';
   
let findingRooms = false;
let pauseTestUser = false;

function ptu(){
  pauseTestUser = !pauseTestUser;
  console.log('pause test user pauseTestUser=',pauseTestUser);
}


function checkHubIfNoTaskIdYet(){

  !taskId && !findingRooms && socket.emit('check-hub');
  !taskId && !findingRooms && console.log(`!taskId && !findingRooms check-hub again...`);
  !taskId && !findingRooms && setTimeout(checkHubIfNoTaskIdYet,6000);
}

socket.on('connected-user',data=>{
    console.log('connected-user',data);
    
    if(location.href.indexOf('chat/room')>-1){
      checkHubIfNoTaskIdYet();
    }
});

socket.on('go-home',data=>{
    console.log('go-home',data);
    setTimeout(function(){
        location.href = rootPath;
    },6000);
});