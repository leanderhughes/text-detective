
function setDisplayMode(displayMode){
    localStorage.setItem('displayMode',displayMode);
    formatForDisplayMode();
}

function formatForDisplayMode(){
    !localStorage.getItem('displayMode') && localStorage.setItem('displayMode','light');
    const displayMode = localStorage.getItem('displayMode');
    const detImg1 = document.querySelector('#detective-image-1');
    const detImg2 = document.querySelector('#detective-image-2');
    const highlightBackgroundColor = displayMode=='dark' ? "#3a3a00" : "#ff0";
    const textColor = displayMode=='dark' ? 'white' : 'black';
    const errorTextColor = displayMode=='dark' ? '#f66' : '#e00';
    const backgroundColor = displayMode=='dark' ? 'black' : 'white';
    const buttonBackgroundColor = displayMode=='dark' ? '#333' : '#eee';
    const imageOpacity = displayMode=='dark' ? .3 : 1;
    elem.as({
        style:{
            innerHTML:`
                :root {
                    --background-color:${backgroundColor}
                }
                body,button,input,textarea,.card {
                    color:${textColor};
                    background-color: ${backgroundColor};
                }
                button {
                    background-color: ${buttonBackgroundColor};                   
                }
                .bg-primary {
                    background-color: #222!important;
                }
                .highlighted {
                    background-color: ${highlightBackgroundColor};
                }
                #output a, #test a {
                    color:${textColor};
                }

                .error-text {
                    color:${errorTextColor};
                }

                .detective-image {
                    opacity:${imageOpacity}
                }

                .blurred {
                    filter: blur(5px);
                    -webkit-filter: blur(5px);
                    color: transparent;
                    text-shadow: 0 0 8px ${textColor};
                    -webkit-touch-callout: none; /* iOS Safari */
                    -webkit-user-select: none; /* Safari */
                     -khtml-user-select: none; /* Konqueror HTML */
                       -moz-user-select: none; /* Old versions of Firefox */
                        -ms-user-select: none; /* Internet Explorer/Edge */
                            user-select: none; /* Non-prefixed version, currently
                                                  supported by Chrome, Edge, Opera and Firefox */
                }

                .blurred-more {
                    filter: blur(5px);
                    -webkit-filter: blur(5px);
                    color: transparent;
                    text-shadow: 0 0 8px ${textColor};
                    -webkit-touch-callout: none; /* iOS Safari */
                    -webkit-user-select: none; /* Safari */
                     -khtml-user-select: none; /* Konqueror HTML */
                       -moz-user-select: none; /* Old versions of Firefox */
                        -ms-user-select: none; /* Internet Explorer/Edge */
                            user-select: none; /* Non-prefixed version, currently
                                                  supported by Chrome, Edge, Opera and Firefox */
                }
                    
            `
        }
    }).to(document.body);
    if(!detImg1){
        return;
    }
    if(displayMode=='light'){
        detImg1.src = detImg1.src.replace('_dark','_light');
        detImg2.src = detImg2.src.replace('_dark','_light');
        return;
    }
    if(displayMode=='dark'){
        return;
    }
    console.log('unknown displayMode',displayMode);
}
formatForDisplayMode();