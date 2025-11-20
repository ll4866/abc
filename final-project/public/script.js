// Entering Username:
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');
const myUserId = getOrCreateUserId();
console.log('My userId:', myUserId);

// check if we have a username already
let myUsername = localStorage.getItem("chat-username");
if(myUsername){
    console.log("my username is", myUsername);
    nameInput.value = myUsername;
} else {
    myUsername = "";
}

nameSubmit.addEventListener('click', function() {
    sendName();
});

nameInput.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        sendName();
    }
});

/* ------------------------------------ */
// SOCKETS:
if(location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')){
    socket = io({path: "/YOURPATH-and-PORT/socket.io"});  // yields '/leon/port-4100/socket.io' or '/socket.io'
}else{
    socket = io(); 
}
/* ------------------------------------ */
// FUNCTIONS:

function sendName() {
    // IGNORE submission if empty
    if (!myUsername) return;

    // save name locally
    localStorage.setItem("chat-username", nameInput.value);

    // "login" to server, sending out identity
    let myInfo = {
        userId: myUserId,
        username: myUsername
    }
    socket.emit("identify", myInfo);
    console.log("sending to socket my info:", myInfo);

    // Erase the naming display
    nameOverlay.style.display = 'none';
}

function getOrCreateUserId() {
    // check if we have a userID already in local storage
    // if yes, return it ELSE create one and return it
    let id = localStorage.getItem("chat-user-id");
    if (id == undefined){
        id = 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem("chat-user-id", id);
    }
    return id;
}