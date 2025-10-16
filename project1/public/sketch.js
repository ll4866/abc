// SOCKET VARIABLES
const prefix = location.pathname.replace(/\/$/, '');      
const socket = io({ path: prefix + '/socket.io' });

// TEXT VARIABLES
const chatInput = document.querySelector('#chatInput');
const chatSend  = document.querySelector('#chatSend');
const bubbles   = {};
const expirePeriod = 1000;

// DEVICE ORIENTATION VARIABLES
let alpha, beta, gamma = 0;
let lastB, lastG = 0;

// USERS VARIABLES
let myID; 
let myX, myY;
let mySpeed         = 0.001;
let boost           = 1;
const othersPOS     = {};
const allPOS        = {};
const allTILT       = {};

// TOUCH VARIABLE
let touchStartTime  = 0;   
let touching        = false;
const MIN_SPEED     = 0.02;
const MAX_SPEED     = 0.1;
const RAMP_MS       = 1500;
const FADE_MS       = 800;

// SHAPE
let numberOfDevices = 0; 
let shapeVertexes = []; 

/* NOTES: 
- ADDING DIRECTION ARROW AND SPEED UP FOR BOOST
*/

/*----------------------------------------------*/
function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);

    // RANDOM CLIENT STARTING POSITION
    myX = random(width);
    myY = random(height);

    canvas.parent("p5-canvas-container");
}

function draw() {
    background(10, 15, 30); 

    // GRADIENT BACKGROUND
    for (let i = 0; i < height; i += 3) {
        let a = map(i, 0, height, 80, 15);
        stroke(120, 160, 255, a);
        strokeWeight(width / 60);  
        line(0, i, width, i);
    }

    // STARS
    randomSeed(31415); 
    for (let i = 0; i < 250; i++) {
        let x = random(width);
        let y = random(height);
        let s = random(1.2, 4);
        let tw = 60 + 25 * sin(millis() * 0.002 + i);
        stroke(255, 255, 220, tw);
        strokeWeight(s);
        point(x, y);
    }
    
    /*----------------------------------------------*/
    /* --- INFORMATION --- */
    // TABLE
    fill(255, 200);
    stroke(0);
    rect(width-85,10, 70, 50, 6);

    // TEXT
    let currentTotal = Object.keys(allPOS).length;
    if ( numberOfDevices !== currentTotal) {
        numberOfDevices = currentTotal;

        // SENDING number of devices and frame size
        socket.emit('count', {c: numberOfDevices, w: windowWidth, h: windowHeight});
        // console.log('ℹ️ Number of Devivce:', numberOfDevices);
    }
    
    noStroke();
    fill(0);
    textAlign(LEFT);
    text("beta: "   + round(beta),      width - 80, 22);
    text("gamma: "  + round(gamma),     width - 80, 35);
    text("devices: "+ numberOfDevices,  width - 80, 48);   

    /*----------------------------------------------*/
    /* --- MOVEMENT --- */
    // DEFAULT TILT
    if (gamma == undefined || beta  === undefined){
        gamma = 0;
        beta  = 0;
    } else {
        // THEY SHOULD NOT BE 0
        if (beta !== 0 && gamma !== 0 ){
            // UPDATE ONLY NEW MOVEMENT
            if (lastG != round(gamma) || lastB != round(beta)){
                lastB = round(beta);
                lastG = round(gamma);
                // SENDING CLIENT's TILT
                socket.emit('tilt', { id: myID, g: lastG, b: lastB });
            }
        }
    }
    
    // MOVEMENT EQUATION
    myX += gamma * mySpeed * boost;
    myY += beta  * mySpeed * boost;
    myX = constrain(myX, 25, width  - 25);
    myY = constrain(myY, 25, height - 25);

    // SPEED UP WHEN TOUCHED
    if (touching) {
        // GRADUAL SPEED UP
        mySpeed = constrain(
            MIN_SPEED + (MAX_SPEED - MIN_SPEED) * ((millis() - touchStartTime) / RAMP_MS),
            MIN_SPEED, MAX_SPEED
        );
    } else {
        // GRADUAL DECREASE
        mySpeed = constrain(
            mySpeed - (MAX_SPEED - MIN_SPEED) / (FADE_MS / deltaTime),
            MIN_SPEED, MAX_SPEED
        );
    }

    // SENDING TO SERVER CLIENT'S MOVEMENT
    socket.emit('move', {id: myID, x:myX, y:myY});

    /*----------------------------------------------*/
    /* --- DRAWING OF USERS --- */
    // DRAWING LINES CONNECTING
    drawConnections(shapeVertexes);
    drawConnections(Object.values(allPOS));
    
    // DRWAWING OTHER CLIENTS
    for (let id in othersPOS) {
        const position = othersPOS[id];
        fill(160, 220, 235);
        ellipse(position.x, position.y, 15);
        drawBubble(bubbles[id], position.x, position.y)
    }

    // DRAW THIS CLIENT
    fill(102, 126, 23);
    ellipse(myX, myY, 30);
    textAlign(CENTER, CENTER);
    fill(255);
    text('Me', myX, myY);  
    drawBubble(bubbles['me'], myX, myY);
}

// DRAWING SHAPE
function drawConnections(data) {
    // ONLY IF THERE ARE >2 CLIENTS
    if (data.length < 2) return;

    // COLOR CHANGE BASED ON GOAL VS CLIENTs
    if(data === shapeVertexes){
        stroke(255, 0, 0);
    } else {
        stroke(160, 220, 235);
    }
    strokeWeight(1.5);
    noFill();


    // DRAWING LINE CONNECTING 
    let prev = data[0];
    for (let i = 1; i < data.length; i++) {
        const curr = data[i];
        line(prev.x, prev.y, curr.x, curr.y);
        prev = curr;
    }
    const first = data[0];
    line(prev.x, prev.y, first.x, first.y);
    
    // DRAWING VERTEXES
    if(data === shapeVertexes){
        for (const p of data) {
            for (let i = 1; i < 4; i++){
                circle(p.x, p.y, 6 * i);
            }
        }
    }
    noStroke();
}
/*----------------------------------------------*/
// SOCKET COMMUNICATION
// LISTENING FOR MY CLIENT ID
socket.on('connect', function(){ 
    myID = socket.id;
    needsShape = true;
    // console.log('ℹ️ My socket id:', myId);
});

// LISTENING FOR GOAL SHAPE
socket.on('shape', function(data){
    shapeVertexes = data;
    // console.log('ℹ️ Vertex data', data);
})

// LISTENING FOR OTHER CLIENT LOCATION
socket.on('update', function(data) {
    // PREVENT UNDEFINED CLIENT
    if (data.id !== undefined) {
        // SAVE ALL CLIENTS
        allPOS[data.id] = { 
            x: data.x, 
            y: data.y 
        };
        // console.log('ℹ️ All user position data:', allPOS);

        // SAVE ALL OTHER CLIENTS
        if(data.id !== myID){
            othersPOS[data.id] = {
                x: data.x, 
                y: data.y 
            }
        }
        // console.log('ℹ️ Other user position data', othersPOS);
    }
});

// LISTENING FOR CHATMESSAGE INFO
socket.on('allChat', function(data){
    // IGNORE IF IT IS MY MESSAGE
    if (data.id !== myID) {
        // STORE INFO
        bubbles[data.id] = {
            text: data.text, 
            time: millis() + expirePeriod
        };
        // console.log('ℹ️ chat:', bubbles[data.id]);
        // console.log('current time:', millis());
    }
});

// LISTENING FOR TILT CONDITION
socket.on('allTilt', function(data){ 
    boost = data;
    // console.log('ℹ️ Other user tilt data', data);
});

// LISTENING FOR DISCONNECTED CLIENT
socket.on('left', function(id){
    // REMOVE DATA ABOUT THEM
    delete othersPOS[id];
    delete allPOS[id];
    delete allTILT[id];
      // console.log('ℹ️ A user left');
});
/*----------------------------------------------*/
// CHAT CONTROLS
chatSend.addEventListener('click', function() {
    sendChat()
});

chatInput.addEventListener('keyup', function(e){ 
    if (e.key === 'Enter') {
        sendChat(); 
    }
});

// CHAT FUNCTION
function sendChat() {
    const txt = chatInput.value.trim();

    // IGNORE EMPTYBOX
    if (!txt) return;

    // ADDING EXPIRATION TIME AND SAVING DATA
    const pack = {
        text: txt, 
        time: millis() + expirePeriod
    };
    bubbles['me'] = pack;
    // console.log('ℹ️ chat:', bubbles['me']);
    // console.log('current time:', millis());

    // SENDING MY MESSAGE TO SERVER
    socket.emit('chat', pack);

    // CLEAR CHATBOX
    chatInput.value = '';

    // HIDE MOBILE KEYBOARD
    chatInput.blur();
}

function drawBubble(id, x, y){
    // BUBBLE TEXTBOX
    let bubbleMargin = 4;
    let bubbleX = 20;
    let bubbleY = 30;
    let adjust = 0;

    if (id){
        // REMOVE TEXT ONCE EXPIRE
        if (millis() < id.time) {
            // COLOR AND DIRECTION ADJUSTMENT
            if(id != bubbles['me']){
                fill( 255, 255, 0, 200);
                adjust = -10;
            } else {
                fill(255);
                bubbleX = -bubbleX;
                adjust = 0;
            }

            // BUBBLE
            rect(
                x - textWidth(id.text)/2 - bubbleMargin + bubbleX, 
                y - bubbleY - 10,
                textWidth(id.text) + 2 * bubbleMargin,
                20, 
                8
            );
            
            // TEXT
            fill(0);
            text(id.text,
                x + bubbleX + adjust, 
                y - bubbleY
            );            
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
    // console.log('ℹ️ Orientation:', eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;      
}