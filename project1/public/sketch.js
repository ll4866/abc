// SOCKET VARIABLES
const prefix = location.pathname.replace(/\/$/, '');      
const socket = io({ path: prefix + '/socket.io' });

// TEXT VARIABLES
const chatInput = document.querySelector('#chatInput');
const chatSend  = document.querySelector('#chatSend');
const bubbles   = {};

// DEVICE ORIENTATION VARIABLES
let alpha, beta, gamma = 0;

// USERS VARIABLES
let myID; 
let myX, myY;
let mySpeed = 0.02;
const others           = {}; 

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);

    // random position
    myX = random(width);
    myY = random(height);

    canvas.parent("p5-canvas-container");
}

function draw() {
    background(143, 220, 227);

    /* --- INFORMATION --- */
    // table
    fill(255, 200);
    stroke(0);
    rect(width-85,10, 70, 50, 6);

    // text
    let numberOfDevices = Object.keys(others).length + 1
    noStroke();
    fill(0);
    textAlign(LEFT);
    text("beta: "  + round(beta),  width - 80, 22);
    text("gamma: " + round(gamma), width - 80, 35);
    text("devices: "+ numberOfDevices,   width - 80, 48);   

    /* --- MOVEMENT --- */
    // default center location 
    if (gamma == undefined || beta  === undefined){
        gamma = 0;
        beta  = 0;
    }

    // movement
    myX += gamma * mySpeed;  
    myY += beta  * mySpeed; 
    myX = constrain(myX, 25, width  - 25);
    myY = constrain(myY, 25, height - 25);

    // SENDING information of my object's movement
    socket.emit('move', {id: myID, x:myX, y:myY});

    /* --- DRAWING OF USERS --- */
    // bubble textbox
    let bubbleMargin = 4;
    let bubbleX = 20;
    let bubbleY = 30;

    // other user
    for (let id in others) {
        //get position of the given ID
        const position = others[id];
        fill(0);
        ellipse(position.x, position.y, 30);

        if (bubbles[id]) {
            // bubble
            fill(255, 255, 0, 200);
            rect(position.x - textWidth(bubbles[id].text)/2 - bubbleMargin - bubbleX, 
                position.y - bubbleY - 10,
               textWidth(bubbles[id].text) + 2 * bubbleMargin, 
               20, 
               8
            );

            // text
            fill(0);
            text(bubbles[id].text,
                position.x - 3 * bubbleX / 2, 
                position.y - bubbleY
            );

            // remove text once expire
            if (millis() > bubbles[id].expirationTime) {
                delete bubbles[id];
            }
        }
    }

    // this user
    fill(255,0,0);
    ellipse(myX, myY, 30);
    textAlign(CENTER, CENTER);
    fill(255);
    text('Me', myX, myY);  

    // my message
    if (bubbles['me']) {
        // bubble
        fill(255);
        rect(myX - textWidth(bubbles['me'].text)/2 - bubbleMargin + bubbleX, 
            myY - bubbleY - 10,
            textWidth(bubbles['me'].text) + 2 * bubbleMargin, 
            20, 
            8
        );

        // text
        fill(0);
        text(bubbles['me'].text, myX + bubbleX, myY - bubbleY);

        // remove text once expire
        if (millis() > bubbles['me'].expirationTime) {
            delete bubbles['me'];
        }
    }
}

// SOCKET COMMUNICATION

// LISTENING to know my ID
socket.on('connect', function(){ 
    myID = socket.id;
    // console.log('my socket id:', myId);
});

// LISTENING for 'other' users location data
socket.on('update', function(data) {
    if (data.id !== undefined && data.id !== myID) {
        others[data.id] = { 
            x: data.x, 
            y: data.y 
        };
        // console.log(others);
    }
});

// LISTENING for chatmessage info
socket.on('allChat', function(data){
    // ignore if we don’t know the sender yet
    if (data.id !== myID) {
        // store data into bubbles
        bubbles[data.id] = { 
            text: data.text, 
            expirationTime: data.expirationTime 
        };
        // console.log(data);
    }
});

// LISTENING for disconnected users
socket.on('left', function(id){
    // console.log('a user left');
    delete others[id];
});



// CHAT CONTROLS
chatSend.addEventListener('click', function() {
    sendChat()
});

chatInput.addEventListener('keyup', function(e){ 
    if (e.key === 'Enter') sendChat(); 
});

function sendChat(data) {
    const txt = chatInput.value.trim();

    // ignore empthy textbox
    if (!txt) return;

    // 5 second expiration time
    const pack = {
        id: myID, 
        text: txt, 
        expirationTime: millis() + 5000
    };

    // show message locally
    bubbles['me'] = pack;

    // send my message to other users
    socket.emit('chat', pack);

    // clear chatbox
    chatInput.value = '';

    // hide mobile keyboard
    chatInput.blur();
}




// Speed
function touchStarted() {

}




function handleOrientation(eventData){
    document.querySelector('#requestOrientationButton').style.display = "none";
    // console.log(eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;      
}