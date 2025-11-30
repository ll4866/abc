/* ------------------------------------ */
// NAME PAGE

// Entering Username:
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');
const myUserId = getOrCreateUserId();
console.log('My userId:', myUserId);

// Check if we have a username already
// YES  -> have textbox contain previous local username
// NO   -> have textbox be blank
let myUsername = localStorage.getItem("chat-username");
if(myUsername){
    console.log("my username is", myUsername);
    nameInput.value = myUsername;
} else {
    myUsername = "";
}

// When "Button" is clicked or "Enter Key" entered:
// calls for sendName()
nameSubmit.addEventListener('click', sendName);
nameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') sendName();
});

// When "Button" is clicked
// sends the avatar to server
const avatarSubmit = document.getElementById("avatarSubmit");
avatarSubmit.addEventListener("click", submitAvatar);

/* ------------------------------------ */
// CANVAS SECTION

// drawing tools
let myDrawingPoints = [];
let isDrawing = false;

// drawing the map
let showMap = false;
let alpha, beta, gamma = 0;
// XY-Coodinates of user & map
let mapX = 0;
let mapY = 0;
let moveScale = 1;

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("p5-canvas-container");
}

function draw(){    
    /* ------------------------------------ */
    // AVATAR SECTION
    background(255);

    // When client has already named:
    if (isDrawing){
    
        // show Button
        avatarSubmit.style.display = "block"; 

        // instructions
        drawingContext.setLineDash([10, 5]); // https://editor.p5js.org/aahyes/sketches/DwvjDrMSz
        textSize(30);
        strokeWeight(3);
        textAlign(CENTER);
        text("DRAW YOUR AVATAR:", width/2, height/4);

        // dashed circle
        drawingContext.setLineDash([5, 15]);
        strokeWeight(5);
        noFill();
        circle(width/2, height/2, 200);

        // draw avatar
        drawingContext.setLineDash([]); 
        stroke(0);
        strokeWeight(10);
        noFill();
        for (let strokeArr of myDrawingPoints) {
            beginShape();
            for (let pt of strokeArr) {
                vertex(pt.x, pt.y);
            }
            endShape();
        }
    } else {
        avatarSubmit.style.display = "none";
    }

    /* ------------------------------------ */
    // MAP SECTION
    if (showMap == true){

        // TESTING: orientation state
        fill(0);
        strokeWeight(1);
        textSize(12);
        text("beta: " + round(beta), width/2, 74);
        text("gamma: " + round(gamma), width/2, 87);

        if (round(gamma) > 35){
            console.log('the user is moving right');
            mapX = mapX - moveScale;
        }

        if (round(gamma) < -35){
            console.log('the user is moving left');
            mapX = mapX + moveScale;
        }

        if (round(beta) > 25){
            console.log('the user is moving dowm');
            mapY = mapY - moveScale;
        }

        if (round(beta) < -25){
            console.log('the user is moving up');
            mapY = mapY + moveScale;
        }

        push();
            translate(mapX, mapY);
            rect(0,0,100,200);
        pop();

        // draw avatar
        push();
            translate(width/4,height/4);
            scale(0.5);
            drawingContext.setLineDash([]); 
            stroke(0);
            strokeWeight(10);
            noFill();
            for (let strokeArr of myDrawingPoints) {
                beginShape();
                for (let pt of strokeArr) {
                    vertex(pt.x, pt.y);
                }
                endShape();
            }
        pop();
    } else {
        document.querySelector('#requestOrientationButton').style.display = "none";
    }
}

/* ------------------------------------ */
// DRAWING TOOL
function touchStarted() {
    // start drawing avatar
    if (!isDrawing) return;
    myDrawingPoints.push([]);
}

function touchMoved() {
    // record avatar drawn stroke
    if (!isDrawing) return;
    for (let t of touches) {
        myDrawingPoints[myDrawingPoints.length - 1].push({ x: t.x, y: t.y });
    }
}

function touchEnded() {
}

/* ------------------------------------ */
// SOCKETS:
if(location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')){
    socket = io({path: "/YOURPATH-and-PORT/socket.io"});  // yields '/leon/port-4100/socket.io' or '/socket.io'
}else{
    socket = io(); 
}

// Listeing for avatar of other players
socket.on('new-avatar', (avatarData) => {
    console.log('New avatar received from another user:', avatarData);
    // You can draw it on canvas or store it
});

/* ------------------------------------ */
// FUNCTIONS:

// UserID creation & memory
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

// Sending name to Server
function sendName() {
    myUsername = nameInput.value;

    // IGNORE submission if empty
    if (!myUsername) return;

    // save name locally
    localStorage.setItem("chat-username", nameInput.value);

    // "login" to server, sending out identity
    let myInfo = {
        userId: myUserId,
        username: nameInput.value
    }
    socket.emit("identify", myInfo);
    console.log("sending to socket my info:", myInfo);

    // erase the naming display
    nameOverlay.style.display = 'none';

    // start Drawing Avatar:
    isDrawing = true;
}

// Sending avatar to Sever
function submitAvatar() {
    // remove empty stroke arrays
    const cleanedDrawing = myDrawingPoints.filter(strokeArr => strokeArr.length > 0);

    // send avatar data to the server
    socket.emit("submit-avatar", cleanedDrawing);
    console.log('Avatar submitted!', cleanedDrawing);

    // stop drawing avatar
    isDrawing = false;
    avatarSubmit.style.display = 'none';

    // start showing the map
    showMap = true;
    document.getElementById('requestOrientationButton').style.display = 'block';
}

function handleOrientation(eventData){
    document.querySelector('#requestOrientationButton').style.display = "none";
    // console.log(eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;
}