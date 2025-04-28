function isTestUser(){
 return false;
    
    if(!location.href.match(/chat\/room/)){
        return false;
    }
    return username.match(/hughes/) || username.match(/chat/) || username.match(/note/);
}

const specialAlerts = {
    '#main':function(){
        return window.location.href.split('chat/room')[0]+'/tasks/';
    },
    '#task':function(){
        if(taskId){
            return window.location.href.split('chat/room')[0]+'/tasks/'+taskId;
        }
        return window.location.href;
    },
    '#logout':function(){
        window.location.href = rootPath+'/users/logout';
    }
};
function formatSpecialUrls(url){
    return specialAlerts[url] ? specialAlerts[url]() : url;
}
function alertMessageAndGoTo(data){
    closeMessage();
    closeMessage();
    let {message,msg,url} = data;
    message = !message ? msg : message;
    // if(typeof message != 'object' || message.indexOf('>')==-1){
    //     message = `div>${message}`;
    // }
    showMessage(message,function(){
        window.location.href = formatSpecialUrls(url);
    });
}

socket.on('alert-message-and-go-to',data=>{
    alertMessageAndGoTo(data);
});

socket.on('alert-and-go-to',data=>{
    console.log('alert-and-go-to',data);
    alertMessageAndGoTo(data);
});

socket.on('go-to',data=>{
    const wait = 0;//localStorage.getItem('wait') ? parseFloat(localStorage.getItem('wait')) : 0
    const randomDelay = data.randomDelay  ? Math.random() * data.randomDelay : 0;
    const delay = data.delay ? data.delay : 0;
    console.log('go-to delay',randomDelay);
    setTimeout(function(){
        location.href = rootPath+'/'+data.url;
    },randomDelay+delay);
});

function confirmRoomRequest(data){
    console.log('confirm-room-request',data);
    const {rooms} = data;
    rooms.push(...[{_id:'new1'},{_id:'new2'},{_id:'new3'},{_id:'new4'},{_id:'new5'}]);
    function memberEl(id,username=''){
        username = username ? username.split('@')[0] : ' &nbsp; '
        return elem.as({
            div:{
                id,
                className:'member-el',
                style:{
                    border:'solid 2px black',
                    margin:'2px 2px 2px 2px',
                    borderRadius:'4px 4px 4px 4px',
                    backgroundColor:'gray',
                    width:'50px',
                    display:'inline-block'
                },
                innerHTML:username,
                callback:function(el){
                    $(el).draggable();
                }     
            }
        });
    }
    function roomEl(id){
        return elem.as({
            div:{
                id,
                className:'room-el',
                style:{
                    width:'400px',
                    height:'50px',
                    marginTop:'10px',
                    backgroundColor:'lightGray',
                    border:'2px solid black',
                    borderRadius:'10px 10px 10px 10px',
                    padding: '2px 2px 2px 2px'

                },
                callback:function(el){
                    $(el).droppable({
                        drop: function(event, ui) {
                            // do something with the dock
                            //$(this).doSomething();
            
                            // do something with the draggable item
                            //$(ui.draggable).doSomething();
                            const id = $(ui.draggable).attr('id');
                            const username = $(ui.draggable).html();
                            $(ui.draggable).remove();
                            $(el).append(memberEl(id,username));
                        }
                   });
                }
            }
        });
    } 
    const confirmRoomOb = [
        'div',
        ...rooms.reduce((roomEls,r)=>{
            roomEls.push(roomEl(r._id));
            if(!r.users || !r.users.length){
                return roomEls;
            }
            roomEls.push(1);
            roomEls.push(...r.users.map(u=>{
                return memberEl(u.socketId,u.username);
            }));
            roomEls.push(-1);
            return roomEls;
        },[]),
        {
            button:{
                id:'room-confirm-button',
                innerHTML:'confirm',
                onclick:function(){
                    const newRooms = [];
                    $('.room-el').each(function(){
                        const room = this;
                        const newRoom = {id:room.id,users:[]};
                        $(room).find('.member-el').each(function(){
                            newRoom.users.push({socketId:this.id});
                        });
                        newRooms.push(newRoom);
                    });
                   
                    socket.emit('confirm-rooms',{newRooms});
                    $('#subWindowContainer,#subWindowMask').remove();
                }
            }
        }
        // roomEl('r1'),
        // 1,
        // memberEl('m1'),
        // memberEl('m2'),
        // -1,
        // roomEl('r2'),
        // 1,
        // memberEl('m3'),
        // -1

    ];
      
    console.log('confirmRoomOb',confirmRoomOb);
    showInSubWindow($('h1')[0],confirmRoomOb,'noDefaultClose');
}

socket.on('confirm-room-request',data=>{
    confirmRoomRequest(data);
});

false && confirmRoomRequest({
    rooms:[
        {
            _id:'a',
            users:[
                {socketId:'w'},
                {socketId:'e'},
                {socketId:'r'}
            ]
        },
        {
            _id:'b',
            users:[
                {socketId:'u'},
                {socketId:'i'},
                {socketId:'o'}
            ]
        },
        {
            _id:'c',
            users:[
                {socketId:'n'},
                {socketId:'m'},
                {socketId:'x'}
            ]
        }
    ]
});

function backSoon(message="(Text Detective is closed temporarily. Please come back and try again soon!)"){
    if(username.match(/@ms/)){
        alertMessageAndGoTo({message,url:'#logout'});
    }

    
}

$('.start-task-for-all').on('click',function(){
    showMessage('Starting task for all.');
    setTimeout(function(){

        window.location.reload();
    },2000);
});


socket.on('log-message',data=>{
    console.log('log-message',data);
});
  
socket.on('alert-message',message=>{
    alertMessage(message);
});
socket.on('timeout-message',(message,timeLeft=false)=>{
    timeoutMessage(message,timeLeft);
});

socket.on('alert-error',error=>{
    const {message,data} = error;
    $('#content').css('visibility','hidden');
    showMessage(message);
});

//backSoon();

