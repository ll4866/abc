// SOCKET VARIABLES
const prefix = location.pathname.replace(/\/$/, '');      
const socket = io({ path: prefix + '/socket.io' });

// TEXT VARIABLES
const chatInput = document.querySelector('#chatInput');
const chatSend  = document.querySelector('#chatSend');
const bubbles   = {};
const expirePeriod = 5000;

// DEVICE ORIENTATION VARIABLES
let alpha, beta, gamma = 0;
let lastB, lastG = 0;

// USERS VARIABLES
let isItMe          = false;
let myName          = '';
let myID; 
let myX, myY;
let mySpeed         = 0.001;
let boost           = 1;
const othersPOS     = {};
const allPOS        = {};
const otherTILT     = {};
const userNames     = {}; 

// GAME FUNCTION
let timeLeft        = 0;
let myScore         = 0;
let gameON          = true;
let rankingData     = null;
let freezeEnd       = 0;
let lastSentScore   = 0;
let highestScore    = 0;

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

/*----------------------------------------------*/
function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);

    // RANDOM CLIENT STARTING POSITION
    myX = random(width);
    myY = random(height);

    canvas.parent("p5-canvas-container");
}

function draw() {
    /* ===  FREEZE HANDLING  === */
    // STOP GAME
    if (!gameON) {
        // SHOW RANKING
        drawRankingBoard();

        // 15 SEC SHOWCASE
        if (millis() > freezeEnd) {
            // HIDE RANKING
            showRankingOverlay(false);
            
            // RESET EVERYTING ONCE TIME IS OUT
            gameON   = true;
            myScore  = 0;
            rankingData = null;
        }
        return;
    }
  /* ============================= */
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
    rect(width-60,10, 55, 50, 6);
    rect(5, 10, 90, 50, 6);

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
    textSize(10);
    text("beta: "   + round(beta),      width - 52.5, 22);
    text("gamma: "  + round(gamma),     width - 52.5, 35);
    text("devices: "+ numberOfDevices,  width - 52.5, 48);  

    // TURN NEGATIVE
    if (timeLeft > 0) {
        timeLeft -= deltaTime;
    }

    // MATCH COUNT & TIME
    let goal = numberOfDevices * 12 + 10; 
    text("My Points: " + myScore + "/" + goal,                10, 22);
    text("Time Left: " + max(0, ceil(timeLeft / 1000)) + "s", 10, 35);    
    text("Leading Score: " + highestScore,                    10, 48);    

    // IF SCORE REACH GOAL TELL SERVER
    if (myScore > goal) {
        // SENDING TO SERVER CLIENT PASS GOAL
        socket.emit('goalMET');
        // console.log('goalMET');
    } else {
        sendScoreIfChanged();
    }
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
    
    // DRAWING OTHER CLIENTS
    isItMe = false;
    for (let id in othersPOS) {
        const position = othersPOS[id];

        // GETTING TILT DATA 
        // IF NO DATA = 0
        let t;
        if (otherTILT[id] !== undefined) {
            t = otherTILT[id];
        } else {
            t = { b: 0, g: 0 };
        }

        // GETTING NAME INFO 
        // IF NO INFO USE ID
        let name;
        if (userNames[id]) {
            name = userNames[id];
        } else {
            name = id;
        }

        // DRAW OTHER CLIENTS
        isItMe = false;
        arrow(t.b, t.g, position.x, position.y); 
        drawName(userNames[id], position.x, position.y, false);
        drawBubble(bubbles[id], position.x, position.y);
    }

    // DRAW THIS CLIENT
    isItMe = true;
    arrow(beta, gamma, myX, myY);
    drawName(myName, myX, myY, true);
    drawBubble(bubbles['me'], myX, myY);
}

function drawName(name, x, y, isMe) {
    push();
        textAlign(CENTER, CENTER);

        let w = textWidth(name);
        let h = textAscent();
        let pad = 5;

        // DIFFERENTIATE OTHER AND USER COLOR
        if (isMe) {
            fill(102, 126, 23, 80); 
        } else {
            fill(160, 220, 235, 80); 
        }

        // RECTANGLE BUBBLE
        rect(
            x - w / 2 - pad, 
            y - 25 - h / 2 - pad,
            w + 2 * pad, 
            h + 2 * pad,
            8
        );

        // DIFFERENTIATE OTHER AND USER COLOR 
        if (isMe) {
            fill(180);
        } else {
            fill(0); 
        }
        text(name, x, y - 25);
    pop();
}

// DRAWING SHAPE
function drawConnections(data) {
    // ONLY IF THERE ARE >2 CLIENTS
    if (data.length < 2) return;

    // COLOR CHANGE BASED ON GOAL VS CLIENTs
    if(data === shapeVertexes){
        stroke(255);
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
            for (let i = 1; i < 3; i++){
                drawStar(p.x, p.y, 3 * i, 6 * i, 5);
            }
        }
    }
    noStroke();
}

// DRAWING ARROW
function arrow(b, g, x, y){
    // CALCULATE ANGLE USING ARC TANGENT
    const angle = atan2(b, g);
    push();
        translate(x, y);
        rotate(angle);

        // DIFFRENTIATE ME FROM OTHER
        let size = 15;
        if (isItMe == false) {
            size = 10;
            stroke(160, 220, 235);
            fill(160, 220, 235);
        } else {
            size = 15;
            stroke(102, 126, 23);
            fill(102, 126, 23);
        }

        // IF BOOST CHANGE COLOR
        if (boost > 1) {
            stroke(255, 0,0);
            strokeWeight(5);
            line(0, 0, size + 5, 0);
            line(size + 5, 0, size - size/10, -10);
            line(size + 5, 0, size - size/10,  10);
            fill(255, 0, 0);
        } else {
            strokeWeight(2);
            line(0, 0, size + 2.5, 0);
            line(size + 2.5, 0, 4/5 * size, -8);
            line(size + 2.5, 0, 4/5 * size,  8);
        }

        ellipse(0, 0, size + 5);
    pop();
}

// DRAWING STARS
function drawStar(x, y, rInner, rOuter, nPoints) {
    // CALCULATE ANGLE FOR EACH VERTEX
    let angle = TWO_PI / (nPoints * 2);
    beginShape();
        // EACH VERTEX ANGLE
        for (let i = 0; i < TWO_PI; i += angle) {
            // IF IT IS AN OUTER VERTEX OR INNNER 
            // CHANGE RADIUS
            let r;
            if (i / angle % 2 === 0) {
                r = rOuter;
            } else {
                r = rInner;
            }

            // DRAW VERTEX
            vertex(
                x + cos(i - PI / 2) * r, 
                y + sin(i - PI / 2) * r
            );
        }
    endShape(CLOSE);
}

// CHECK IF SCORE CHANGED
function sendScoreIfChanged() {
    if (myScore !== lastSentScore) {
        // SENDING TO SERVER
        socket.emit('highScore', myScore );

        // UPDATE NEW SCORE
        lastSentScore = myScore;
        console.log('Score sent to server:', myScore);
    }
}
/*----------------------------------------------*/
// SOCKET COMMUNICATION

// LISTENING FOR HIGHEST SCORE FOR NOW
socket.on('highestScore', function(score){
    highestScore = score ;
    console.log("Received highScore:", score);
})

// LISTENING IF ANYONE HAS WON
socket.on('requestSCORES', function(){
    // IF SO SEND INDIVIDUAL SCORES TO SERVER
    socket.emit('individualScores', {
        id: myID,
        score: myScore
    });
    // console.log('Sending my scores');
})

// LISTENING FOR THE SCORES OF OTHERS
socket.on('AllSCORES', function(data){
    // STORING THE SCORES
    rankingData = data;
    // console.log('received all score: ', data);
})

// LISTENING WHEN TO STOP GAME AND SCORE
socket.on('freezeGame', (ms) => {
    // FREEZE THE GAME
    gameON = false;
    // console.log('gameON:', gameON);

    // COUNTDOWN
    freezeEnd = millis() + ms;

    // SHOWCASE RANKING
    showRankingOverlay(true);
  });

// LISTENING FOR THE NAMES THE USERS HAVE GIVEN
socket.on('userList', list => {
    Object.assign(userNames, list);
    // console.log('ℹ️ ID names:', userNames);
});

// LISTENING FOR MY CLIENT ID
socket.on('connect', function(){ 
    myID = socket.id;
    needsShape = true;
    // console.log('ℹ️ My socket id:', myID);
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
        // console.log('ℹ️ chat:', bubbles);
        // console.log('ℹ️ chat:', bubbles[data.id]);
        // console.log('current time:', millis());

        // ADD 1 POINT PER CHAT MESSAGE RECEIVED
        myScore += 0.5;
    }
});

// LISTENING FOR TILT CONDITION
socket.on('allTilt', function(data){ 
    boost = data;
    // console.log('ℹ️ Other user tilt data', data);
});

socket.on('otherTilt',function(data){
    if(data.id !== myID){
        otherTILT[data.id] = { 
            b: data.b, 
            g: data.g
        };
        // console.log(otherTILT);
    }
});

// LISTENING FOR DISCONNECTED CLIENT
socket.on('left', function(id){
    // REMOVE DATA ABOUT THEM
    delete othersPOS[id];
    delete allPOS[id];
    delete otherTILT[id];
    delete userNames[id];
    // console.log('ℹ️ A user left');
});

// LISTENING FOR HOW MANY SUCCESS MATCH
socket.on('shapeSuccess', function(data){
    const { order, count } = data;
    const score = 4 * count - 3 * order.indexOf(myID);
    myScore += score;
    // console.log('Your score:', myScore);
});

// LISTENING FOR TIME LEFT UNTIL NEW SHAPE
socket.on('shapeTimer', function(data){
    timeLeft = data.timeLeft* 1000;
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
        id: myID,
        text: txt, 
        time: millis() + expirePeriod
    };
    bubbles['me'] = pack;
    // console.log('ℹ️ chat:', bubbles['me']);
    // console.log('current time:', millis());

    // SENDING MY MESSAGE TO SERVER
    socket.emit('chat', pack);

    // ADD POINTS PER CHAT MESSAGE
    myScore += 2;

    // CLEAR CHATBOX
    chatInput.value = '';

    // HIDE MOBILE KEYBOARD
    chatInput.blur();
}

function drawBubble(id, x, y){
    // BUBBLE TEXTBOX
    let bubbleMargin = 4;
    let bubbleY = - 25;
    textAlign(CENTER,CENTER);

    // PREVENT EMPTY
    if (id){
        // REMOVE TEXT ONCE EXPIRE
        if (millis() < id.time) {
            // COLOR AND DIRECTION ADJUSTMENT
            if(id != bubbles['me']){
                fill(255);
            } else {
                fill( 255, 255, 0, 200);
            }

            // BUBBLE
            rect(
                x - textWidth(id.text)/2 - bubbleMargin, 
                y - bubbleY - 10,
                textWidth(id.text) + 2 * bubbleMargin,
                20, 
                8
            );
            
            // TEXT
            fill(0);
            text( id.text, x, y - bubbleY);            
        }
    }
}

/*----------------------------------------------*/
// NAME HANDLING
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');

// NAME SUBMIT WAYS
nameSubmit.addEventListener('click', function() {
    sendName()
});

nameSubmit.addEventListener('keyup', function(e){ 
    if (e.key === 'Enter') {
        sendName(); 
    }
});

// HOW TO SEND
function sendName() {
    const name = nameInput.value.trim();

    // IGNORE EMPTY
    if (!name) return;

    // SAVE NAME
    myName = name; 
    
    // SENDING MY NAME TO SERVER WHEN CONNECTED
    socket.emit('setName', myName);

    // ERASE DISPLAY ONCE DONE
    nameOverlay.style.display = 'none';

    // SHOW REQUEST AFTER NAMED
    document.getElementById('requestOrientationButton').style.display = 'block';
}

/*----------------------------------------------*/
// RANKING

function showRankingOverlay(show) {
    const board = document.getElementById('rankBoard');

    // IF 'show' then DISPLAY BOARD ELSE DOES NOT
    if (show) {
        board.style.display = 'block';
    } else {
        board.style.display = 'none';
    }
}
  
function drawRankingBoard() {
    const list   = document.getElementById('rankList');
    const countDownSpan = document.getElementById('countDown');

    // SKIP IF EITHER ELEMENTS DOES NOT EXIST
    if (!list || !countDownSpan) {
        return;
    }

    // CHECK IF BOTH `freezeEnd` AND `millis` EXIST
    let left = 0;
    if (freezeEnd && millis) {
        // TIME LEFT CALCULATE
        const timeLeftMs = freezeEnd - millis();
    
        // CONVERT TO SECOND AND ROUND
        left = Math.ceil(timeLeftMs / 1000);
    }
    
    // ENSURE COUNTDOWN DOES NOT GO BELOW 0
    if (left < 0) {
        left = 0;
    }
    
    // UPDATING THE TEXT DISPLAYED IN COUNTDOWN
    countDownSpan.textContent = Math.max(0, left);

    // CLEAR OLD LIST
    list.innerHTML = '';

    // CHECK FOR ANY EMPTY
    if (!rankingData || Object.keys(rankingData).length === 0) {
        // WRITE NO SCORES IF EMPTY
        const li = document.createElement('li');
        li.textContent = "No scores yet";
        list.appendChild(li);
        // console.warn("rankingData is empty or undefined");
        return;
    }

    // CONVERT OBJECT INTO ARRAY PAIRS
    const sorted = Object.entries(rankingData)
                         .sort((a, b) => b[1] - a[1]);

    // LOOP FOR EACH PAIR
    sorted.forEach(([id, score], idx) => {
        // CREATES NEW LIST
        const li = document.createElement('li');

        // SHOW USER NAME + SCORE
        li.textContent = getOrdinal(idx + 1) + '. ' + (userNames[id] || id) + ': ' + score + ' pts';

        list.appendChild(li);
    });
}

function getOrdinal(n) {
    // POSSIBLE ORIDAL
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    // DEPENDING ON NUMBER GIVEN, POSSIBLE ORINAL
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/*----------------------------------------------*/
// TOUCH EVENTS (SCREENTOUCH SPEED)
function touchStarted() {
    // AVOID ORIENTATION BUTTON
    const btn = document.querySelector('#requestOrientationButton');
    if (btn && btn.style.display !== 'none') {
        return true;
    }

    // AVOID TEXT SECTION
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