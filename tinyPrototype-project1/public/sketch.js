// SOCKET VARIABLES
const prefix = location.pathname.replace(/\/$/, '');      
const socket = io({ path: prefix + '/socket.io' });

// TEXT INPUT
const chatInput = document.querySelector('#chatInput');
const chatSend  = document.querySelector('#chatSend');
const bubbles   = {};

// DEVICE ORIENTATION VARIABLES
let alpha, beta, gamma = 0;
let userCount          = 0;
const others           = {}; 
let myX, myY;

// CONDITIONS
const FREEZE_DIST   = 50;         // distance to trigger
const FREEZE_TIME   = 10000;      // timer
const COOL_DOWN     = 2000; 
let frozen          = false;
let freezeEnd       = 0;
let partnerId       = null; 
let msgCount        = 0;
let coolEnd         = 0;  
const colours = {};

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);

    myX = random(width);
    myY = random(height);

    canvas.parent("p5-canvas-container");
}

function draw() {
    background(143, 220, 227);

    // information
    fill(255, 200);
    stroke(0);
    rect(width-85,10, 70, 50, 6);
    noStroke();
    fill(0);
    textAlign(LEFT);
    // text("alpha: " + round(alpha), width - 80, 11);
    text("beta: "  + round(beta),  width - 80, 22);
    text("gamma: " + round(gamma), width - 80, 35);
    text("devices: "+ userCount,   width - 80, 48);
    // console.log("Number of Devices:", userCount);   

    // default center location (until first device orientation event)
    if (gamma === undefined) gamma = 0;
    if (beta  === undefined) beta  = 0;

    // movement
    if (!frozen) {
        myX += gamma * 0.02;  
        myY += beta  * 0.02;
    }   
    myX = constrain(myX, 25, width -25);
    myY = constrain(myY, 25, height-25);

    // 30 fps of sending message of location to socket
    if (frameCount % 2 === 0) socket.emit('move', {x:myX, y:myY});
    
    /* --- DRAWING OF USERS --- */
    // this user
    fill(255,0,0);
    ellipse(myX, myY, 30);
    textAlign(CENTER, CENTER);
    fill(255);
    text('Me', myX, myY);  

    // other user
    for (let [id, c] of Object.entries(others)){
        if (colours[id] === 'blue') {
            fill(0, 150, 255);
        } else {
            fill(0);
        }
        ellipse(c.x, c.y, 30);
    }

    /* --- STRANGER PROXIMITY --- */
    let stranger = null;
    for (let [id, c] of Object.entries(others)) {
        if (dist(myX, myY, c.x, c.y) < FREEZE_DIST) {
            stranger = id;
            break;
        }
    }

    // encounter freeze condition
    // do not converse if color blue
    if (stranger && !frozen && millis() > coolEnd && colours[stranger] !== 'blue') {
        frozen    = true;
        freezeEnd = millis() + FREEZE_TIME;
        partnerId = stranger;
        msgCount  = 0;
        socket.emit('freeze', {partner: stranger});
    }

    // when frozen
    if (frozen) {
        // countdown
        let secLeft = ceil((freezeEnd - millis()) / 1000);

        // label
        fill(255, 220, 0, 200);
        rect(width / 2 - 40, 30, 80, 25, 6);
        fill(0);
        textAlign(CENTER, CENTER);
        text(secLeft + ' s', width / 2, 42);
    }
    
    // end encounter
    if (frozen && millis() > freezeEnd) {
        frozen  = false;
        coolEnd = millis() + COOL_DOWN;          // prevent immediate re-freeze
    
        if (msgCount >= 2) {
            colours[partnerId] = 'blue';      // mark for life
            socket.emit('colour', {id: partnerId});
        }

        partnerId = null;
        msgCount  = 0;
    }

   
    /* --- BUBBLE TEXTBOX --- */
    let bubbleMargin = 4;
    let bubbleX = 20;
    let bubbleY = 30;

    // own message
    if (bubbles['me']) {
        // bubble
        fill(255);
        rect(myX - textWidth(bubbles['me'].text)/2 - bubbleMargin + bubbleX, myY - bubbleY - 10,
            textWidth(bubbles['me'].text) + 2 * bubbleMargin, 20, 8);

        // text
        fill(0);
        text(bubbles['me'].text, myX + bubbleX, myY - bubbleY);

        // remove text once expire
        if (millis() > bubbles['me'].expire) delete bubbles['me'];
    }

    // other user message
    for (let [id, c] of Object.entries(others)) {
        if (bubbles[id]) {
            // bubble
            fill(255, 255, 0, 200);
            rect(c.x - textWidth(bubbles[id].text)/2 - bubbleMargin - bubbleX, c.y - bubbleY - 10,
               textWidth(bubbles[id].text) + 2 * bubbleMargin, 20, 8);
            // text
            fill(0);
            text(bubbles[id].text, c.x - bubbleX, c.y - bubbleY);

            // remove text once expire
            if (millis() > bubbles[id].expire) delete bubbles[id];
        }
    }
}

// SOCKET COMMUNICATION
socket.on('chat', data => {
    data.expire = millis() + 5000;
    bubbles[data.id] = data;
  
    // adding count of how many messages between them
    if (frozen && data.id === partnerId) msgCount++;  
    console.log('count of message:', msgCount);
});
  
socket.on('colour', data => {colours[data.id] = 'blue';});
socket.on('count', c => userCount = c);
socket.on('update', data => { others[data.id] = {x: data.x, y: data.y};});
socket.on('left',   id => delete others[id]);

// Chat Controls
chatSend.addEventListener('click', () => sendChat());
chatInput.addEventListener('keyup', e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const txt = chatInput.value.trim();

    // ignore empthy textbox
    if (!txt) return;

    // 5 second expiration time
    const pack = {text: txt, expire: millis() + 5000};

    // show message locally
    bubbles['me'] = pack;

    // send to other users
    socket.emit('chat', pack);

    // clear chatbox
    chatInput.value = '';

    // hide mobile keyboard
    chatInput.blur();

    // counting number of text during freeeze
    if (frozen && partnerId) msgCount++;
}

function handleOrientation(eventData){
    document.querySelector('#requestOrientationButton').style.display = "none";
    // console.log(eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;      
}