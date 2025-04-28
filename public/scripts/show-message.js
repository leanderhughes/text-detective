if(!elem){
  throw('elem.js is required for showMessage.js to work');
}

const iconReplacements = {
  point:'',
  points:'',
  note:'',
  notes:'',
  time:''
}

function closeMessage(callback){
  $('#mask,#message').remove();
  callback && typeof callback=='function' && callback();
  nextMessages.length && nextMessages.shift()();
  return true;
}

const messagesToCancel = [];

function cancelMessage(args){

  messagesToCancel.includes(args) ? false : messagesToCancel.push(args);
}


const nextMessages = [];
function showMessage(...args){
  if($('#message').length){

    

    nextMessages.push(function(){
      args.unshift('#nextMessage');

      showMessage(args);
    });
    return;
  }
  if(args[0] && [0] && args[0][0]=='#nextMessage'){

    if(args[0].length==2){
      args = typeof args[0][1] == 'string' ? [args[0][1]] : args[0][1];
    }
    if(typeof args[0] != 'string' && args[0].length > 2){
      args = args[0].slice(1);

    }
    
  }

  if(args[0]=='#nextMessage'){
    args.shift();

  }


  const message = typeof args[0] == 'string' ? args.shift() : '';

  if(messagesToCancel.includes(message)){
    
    const cancelIndex = messagesToCancel.indexOf(message);
    messagesToCancel.splice(cancelIndex,1);

    return;
  }
  let callback = args.length && typeof args[0] == 'function' ? args.shift() : false;
  function callback2(keydownEvent=false){
    if(keydownEvent && keydownEvent.key && keydownEvent.key !='Enter'){
      return;
    }
    $(window).off('keydown.message');
    closeMessage(callback);
    
  }
  callback2  = args.length > 1 && Array.isArray(args[0]) && typeof args[1] == 'function' ? args.pop() : callback2;
  !args.length && $(window).on('keydown.message',callback2);
  !args.length && args.push({button:{innerHTML:'OK',style:{marginTop:'20px'},onclick:callback2}});
  args = args.length == 1 && Array.isArray(args[0]) ? args[0] : args;
  $('#maskContainer,#mask,#message').remove();
  let clickedOnMessage = 0;
  const background = $('body').css('background-color') || 'rgba(255,255,255)';
  elem.as(
    {
      div:{
        id:'maskContainer',
        style:{
          position:'absolute',
          left:0,
          top:0,
          width:window.innerWidth+'px',
          height:'10px'
        }
      }
    },
    1,
    {
      div:{
        id:'mask',
        style:{
          position: 'fixed',
          zIndex: 1000,
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: background.slice(0,-1)+',.9)'
        },
        onclick:function(){
          if(new Date().getTime()-clickedOnMessage < 10){
            return;
          }

          callback2();
          
        }
      }
    },
    1,
    {
      div:{
        id:'message',
        style:{
          position:'relative',
          margin: Math.floor((window.innerHeight)*.1)+'px auto',
          width: '600px',
          zIndex: '1500',
          display: 'block',
          textAlign: 'center',
          backgroundColor: background,
          padding: '25px 25px 25px 25px',
          border: '1px solid gray',
          marginTop: Math.floor((window.innerHeight)*.4)+'px',
          maxHeight:Math.floor((window.innerHeight)*.5)+'px',
          overflowY:'auto'
        },
        onclick:function(){
          clickedOnMessage = new Date().getTime();
        },
        callback:function(el){
          if(isTestUser()){

            !pauseTestUser && setTimeout(function(){
              $(el).find('button').slice(0,1).trigger('click');
            },1000);
          }
        }
      }
    },
    1,
    {
      div:{
        innerHTML: message,
        style:{
          textAlign: message.length < 70 ? 'center' : 'left'
        }
      }
    },
    ...args,
    -1,
  -1
  ).to(document.body);
  return true;
}

function timeoutMessage(message,timeLeft=2000){
  const id = `timeoutMessage${new Date().getTime()}`;
  showMessage([
    {
      p:{
        innerHTML: message,
        id,
        callback:function(){
          setTimeout(function(){
            if($(`#${id}`).length){
              closeMessage();
            }
          },timeLeft);
        }
      }
    },
    {
      button:{
        text:'OK',
        onclick:closeMessage
      }
    }
  ]);
}

function showInSubWindow(el,els=[],noDefaultClose=false){
  const elTop = el.getBoundingClientRect().bottom + window.pageYOffset;
  const mask = elem.as(
    {
      div:{
        id:'subWindowMask',
        style:{
          position:'fixed',
          left:0,
          right:0,
          top:0,
          bottom:0,
          backgroundColor: 'inherit',
          opacity:0,
          zIndex: 2,
          display:'block'
        }
      }
    }
  ).to(document.body);

  !els.length && els.push('div');
  let timeMessageClicked = 0;
  const background = $('body').css('background-color') || 'rgba(255,255,255)';
  elem.as([
    {
      div:{
        id:'subWindowContainer',
        style:{
          position:'absolute',
          width:'100%',
          top: 0,
          left: 0,
          zIndex:999999999,
          height:'100%',
          background: background.slice(0,-1)+',.6)'
        }
      }
    },
    {
      div:{
        id:'subWindowMessage',
        style:{
          position:'relative',
          background: background,
          border: '1px solid gray',
          margin:`${elTop}px auto`,
          width:'80%',
          minHeight:'200px',
          display:'block',
          padding:'25px 25px 25px 25px'

        },
        onclick:function(){

          timeMessageClicked = new Date().getTime();
        },
        callback:function(el){
          if(noDefaultClose){
            return;
          }
          function closeSubWindow(){
            if(new Date().getTime() - timeMessageClicked < 10){

              return;
            }
            $('#subWindowMask,#subWindowContainer').remove();

            window.removeEventListener('click',closeSubWindow);
            $('button.gsc-search-button,div.gsc-tabHeader.gsc-tabhInactive.gsc-inline-block').each(function(){
             // this.removeEventListener('click',blockCloseSubWindow);
            });
          }
          window.addEventListener('click',closeSubWindow);
          function blockCloseSubWindow(){
            timeMessageClicked = new Date().getTime();
          }
          $('.gsc-search-button,.gsc-tabHeader').each(function(){
            this.addEventListener('click',blockCloseSubWindow);
          });
        }
      }
    },
    1,
    ...els,
    -1
  ]).to(document.body);

  return true;
}



function alertMessage(message,callback=false){
  window.filterMessageByRoleName = window.filterMessageByRoleName ? window.filterMessageByRoleName : function(msg){return msg;};
  if(callback){
    showMessage(filterMessageByRoleName(message),callback);
    return;
  }
  showMessage(filterMessageByRoleName(message));
}

