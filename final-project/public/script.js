/* ------------------------------------ */
// NAME PAGE
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
let mapW = 4000;
let mapH = 4000;
let otherPlayers = {};

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
        stroke(0);
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
        drawAvatar(myDrawingPoints);
    } else {
        avatarSubmit.style.display = "none";
    }

    /* ------------------------------------ */
    // MAP SECTION
    if (showMap == true){
        // Movement Condition:
            // How much tilt to move direction
            if (round(gamma) > 35){
                // console.log('the user is moving right');
                mapX = mapX - moveScale;
            } 
            if (round(gamma) < -35){
                // console.log('the user is moving left');
                mapX = mapX + moveScale;
            }
            if (round(beta) > 25){
                // console.log('the user is moving dowm');
                mapY = mapY - moveScale;
            }
            if (round(beta) < -25){
                // console.log('the user is moving up');
                mapY = mapY + moveScale;
            }

            // bound user inside map
            if (mapX > 0) {
                mapX = 0;
            } 
            if (mapX < -mapW) {
                mapX = -mapW;
            } 
            if (mapY > 0) {
                mapY = 0;
            }
            if (mapY < -mapH) {
                mapY = -mapH;
            }

        // Draw map (moving)
            push();
                translate(width/2 + mapX, height/2 + mapY);
                fill(14, 99, 107);
                rect(0,0,mapW,mapH);

                // draw other users
                for (let userId in otherPlayers) {
                    // Skip drawing your own avatar here
                    if (userId === myUserId) continue;

                    // other users
                    let p = otherPlayers[userId];
                    push();
                        // Position relative to the map
                        translate(- width/8, - height/8);
                        translate(p.x, p.y);
                
                        scale(0.25);
                        drawAvatar(p.drawing, p.username);
                    pop();
                }
            pop();

        // My avatar (static)
            push();
                translate(3 * width/8, 3 * height/8);
                scale(0.25);
                drawAvatar(myDrawingPoints, myUsername);
            pop();

        // Direction Arrow Around Avatar
            let L = 40;
            push();
                translate(width/2, height/2);

                // convert tilt to an angle
                let angle = atan2(beta, gamma);

                // draw arrow
                rotate(angle);
                strokeWeight(6);
                line(L, 0, L + 15, 0);
                triangle(
                    L + 20, 0,
                    L + 10, 10,
                    L + 10, -10
                );
            pop();

        // TESTING: orientation state
            fill(0);
            strokeWeight(1);
            textSize(12);
            text("beta: " + round(beta), width/2, 74);
            text("gamma: " + round(gamma), width/2, 87);
    } else {
        document.querySelector('#requestOrientationButton').style.display = "none";
    }
}

/* ------------------------------------ */
// DRAWING TOOL

function touchStarted() {
    if (isDrawing) {
        myDrawingPoints.push([]);
    }
}

function touchMoved() {
    if (isDrawing){
        for (let t of touches) {
            myDrawingPoints[myDrawingPoints.length - 1].push({ x: t.x, y: t.y });
        }
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

socket.on('new-avatar', function (avatars) {
    console.log('New avatar received from another user:', avatars);
    otherPlayers[avatars.userId] = avatars;
});

socket.on("location-update", function (loc) {
    if (!otherPlayers[loc.userId]) return;
    otherPlayers[loc.userId].x = loc.x;
    otherPlayers[loc.userId].y = loc.y;
});

/* ------------------------------------ */
// FUNCTIONS:

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

function drawAvatar(drawing, username = "") {
    // avatar
    drawingContext.setLineDash([]);
    strokeWeight(10);
    noFill();
    for (let strokeArr of drawing) {
        beginShape();
        for (let pt of strokeArr) {
            vertex(pt.x, pt.y);
        }
        endShape();
    }

    // username text
    if (username) {
        noStroke();
        fill(0);
        textSize(100);
        textAlign(CENTER, BOTTOM);
        text(username, 200, 200);
    }
}

function handleOrientation(eventData){
    document.querySelector('#requestOrientationButton').style.display = "none";
    // console.log(eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;
}