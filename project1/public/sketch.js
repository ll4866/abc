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
const allINFO          = {};

// TOUCH VARIABLE
let touchStartTime = 0;   
let touching = false;
const MIN_SPEED = 0.02;   // base speed
const MAX_SPEED = 0.1;
const RAMP_MS   = 1500;   // time to increase from 0→max
const FADE_MS   = 800;    // time back to normal speed

// SHAPE
let numberOfDevices = 0; 
let shapeVertexes = []; 

/*----------------------------------------------*/
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
    let currentTotal = Object.keys(allINFO).length;
    if ( numberOfDevices !== currentTotal) {
        numberOfDevices = currentTotal;

        socket.emit('count', {c: numberOfDevices, w: windowWidth, h: windowHeight});
        // console.log('ℹ️ Number of Devivce:', numberOfDevices);
    }
    
    noStroke();
    fill(0);
    textAlign(LEFT);
    text("beta: "   + round(beta),      width - 80, 22);
    text("gamma: "  + round(gamma),     width - 80, 35);
    text("devices: "+ numberOfDevices,  width - 80, 48);   

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

    // speed
    if (touching) {
        // when touching, increase speed
        mySpeed = constrain(
            MIN_SPEED + (MAX_SPEED - MIN_SPEED) * ((millis() - touchStartTime) / RAMP_MS),
            MIN_SPEED, MAX_SPEED
        );
    } else {
        // when released, decrease to normal
        mySpeed = constrain(
            mySpeed - (MAX_SPEED - MIN_SPEED) / (FADE_MS / deltaTime),
            MIN_SPEED, MAX_SPEED
        );
    }

    // SENDING information of my object's movement
    socket.emit('move', {id: myID, x:myX, y:myY});

    /*----------------------------------------------*/
    /* --- DRAWING OF USERS --- */
    // drawing lines connecting
    drawConnections(shapeVertexes);
    drawConnections(Object.values(allINFO));
    
    // other user
    for (let id in others) {
        // get position of the given ID
        const position = others[id];
        fill(0);
        ellipse(position.x, position.y, 30);

        drawBubble(bubbles[id], position.x, position.y)
    }

    // this user
    fill(255,0,0);
    ellipse(myX, myY, 30);
    textAlign(CENTER, CENTER);
    fill(255);
    text('Me', myX, myY);  

    // my message
    drawBubble(bubbles['me'], myX, myY)
}

/*----------------------------------------------*/
// SOCKET COMMUNICATION
// listening to know my ID
socket.on('connect', function(){ 
    myID = socket.id;
    needsShape = true;
    // console.log('ℹ️ My socket id:', myId);
});

socket.on('shape', function(data){
    shapeVertexes = data;
    // console.log('ℹ️ Vertex data', data);
})

// listening for 'other' users location data
socket.on('update', function(data) {
    if (data.id !== undefined) {
        allINFO[data.id] = { 
            x: data.x, 
            y: data.y 
        };
        // console.log('ℹ️ All user data:', allINFO);

        if(data.id !== myID){
            others[data.id] = {
                x: data.x, 
                y: data.y 
            }
        }
        // console.log('ℹ️ Other user data', others);
    }
});

// listening for chatmessage info
socket.on('allChat', function(data){
    // ignore if we don’t know the sender yet
    if (data.id !== myID) {
        // store data into bubbles
        bubbles[data.id] = { 
            text: data.text, 
            expirationTime: data.expirationTime 
        };
        // console.log('ℹ️ chat:', data);
    }
});

// listening for disconnected users
socket.on('left', function(id){
    // console.log('ℹ️ A user left');
    delete others[id];
    delete allINFO[id];
});

/*----------------------------------------------*/
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

function drawBubble(id, x, y){
    // bubble textbox
    let bubbleMargin = 4;
    let bubbleX = 20;
    let bubbleY = 30;

    if (id){
        // bubble
        if(id != bubbles['me']){
            fill( 255, 255, 0, 200);
        } else {
            fill(255);
            bubbleX = -bubbleX;
        }
        rect(
            x - textWidth(id.text)/2 - bubbleMargin + bubbleX, 
            y - bubbleY - 10,
            textWidth(id.text) + 2 * bubbleMargin,
            20, 
            8
        );
        
        // text
        fill(0);
        text(id.text,
            x + bubbleX, 
            y - bubbleY
        );

        // remove text once expire
        if (millis() > id.expirationTime) {
            delete id;
        }
    }
}

/*----------------------------------------------*/
// TOUCH EVENTS
function touchStarted() {
    // avoid orientation button with speed button
    const btn = document.querySelector('#requestOrientationButton');
    if (btn && btn.style.display !== 'none') {
        return true;
    }

    // avoid text button with speed button
    const t = event.target;
    if (t === chatInput || t === chatSend || chatInput.contains(t)) {
        return true;
    }

    touching = true;
    touchStartTime = millis();
    return false; 
}
  
function touchEnded() {
    // avoid orientation button with speed button
    const btn = document.querySelector('#requestOrientationButton');
    if (btn && btn.style.display !== 'none') {
        return true;
    }

    // avoid text button with speed button
    const t = event.target;
    if (t === chatInput || t === chatSend || chatInput.contains(t)) {
        return true;
    }

    touching = false;
    return false;
}

/*----------------------------------------------*/
// ORIENTATION
function handleOrientation(eventData){
    document.querySelector('#requestOrientationButton').style.display = "none";
    console.log('ℹ️ Orientation:', eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;      
}

function drawConnections(data) {
    if (data.length < 2) return;

    if(data === shapeVertexes){
        stroke(255, 0, 0);
    } else {
        stroke(0);
    }
    strokeWeight(1.5);
    noFill();

    // first vertex
    let prev = data[0];

    // connect 1st with 2nd, 2nd with 3rd...
    for (let i = 1; i < data.length; i++) {
        const curr = data[i];
        line(prev.x, prev.y, curr.x, curr.y);
        prev = curr;
    }
    // close the loop: last → first
    const first = data[0];
    line(prev.x, prev.y, first.x, first.y);
    
    // vertexes
    for (const p of data) {
        for (let i = 1; i < 4; i++){
            circle(p.x, p.y, 6 * i);
        }
    }
}