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

// When "Button" is clicked or "Enter" Key entered:
// calls for sendName()
nameSubmit.addEventListener('click', sendName);
nameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') sendName();
});

// When "Button" is clicked
// sends the avatar to server
const avatarSubmit = document.getElementById("avatarSubmit");
avatarSubmit.addEventListener("click", submitAvatar);

// When "Arrow" key is pressed
// location movement boolean
window.addEventListener('keydown', (e) => {
    switch(e.key){
        case "ArrowLeft":  moveLeft = true; break;
        case "ArrowRight": moveRight = true; break;
        case "ArrowUp":    moveUp = true; break;
        case "ArrowDown":  moveDown = true; break;
    }
});

// When "Arrow" key is released
// location movement boolean
window.addEventListener('keyup', (e) => {
    switch(e.key){
        case "ArrowLeft":  moveLeft = false; break;
        case "ArrowRight": moveRight = false; break;
        case "ArrowUp":    moveUp = false; break;
        case "ArrowDown":  moveDown = false; break;
    }
});

/* ------------------------------------ */
// CANVAS SECTION

// drawing tools
let myDrawingPoints = [];
let isDrawing = false;

// drawing the map
let showMap = false;
let alpha, beta, gamma = 0;
let mapW = 2000;
let mapH = 2000;
let otherPlayers = {};

// letters
let letters = [];
let pushRadius = 50;
let pushStrength = 30;
let minDistance = 20;
let lastVisibleLetters = "";
let animalNames = [];
let lettersUsedInAnimals = new Set();

// XY-Coodinates of user & map
let mapX = 0;
let mapY = 0;
let moveScale = 2;
let lastMapX = null;
let lastMapY = null;

// Computer testing
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;

// Buttons Names

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
            // how much tilt to move direction
            if (round(gamma) > 35 || moveRight){
                // console.log('the user is moving right');
                mapX = mapX - moveScale;
            } 
            if (round(gamma) < -35 || moveLeft){
                // console.log('the user is moving left');
                mapX = mapX + moveScale;
            }
            if (round(beta) > 25 || moveDown){
                // console.log('the user is moving dowm');
                mapY = mapY - moveScale;
            }
            if (round(beta) < -25 || moveUp){
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
                rect(0 , 0, mapW, mapH);

                // draw ALL players in map coordinates
                for (let userId in otherPlayers) {
                    let p = otherPlayers[userId];
                    push();
                        translate(p.x - width/8, p.y - width/8);
                        scale(0.25);
                        drawAvatar(p.drawing, p.username);
                    pop();
                }
            pop();
        

        // Letter condition & drawing
            for (let i = 0; i < letters.length; i++) {
                let s = letters[i];
                let dx = (s.x + width/2 + mapX) - width/2;
                let dy = (s.y + height/2 + mapY) - height/2;
                let distance = Math.sqrt(dx*dx + dy*dy);
                
                // if within pushing distance
                if (distance < pushRadius) {
                    // calculate vector direction
                    // move letters away along that vector
                    let ux = dx / distance;
                    let uy = dy / distance;
                    s.x += ux * pushStrength;
                    s.y += uy * pushStrength;

                    // keep letters inside map
                    if (s.x < 0) {
                        s.x = minDistance;
                    }
                    if (s.x > mapW) {
                        s.x = mapW - minDistance;
                    }
                    if (s.y < 0) {
                        s.y = minDistance;
                    }
                    if (s.y > mapH) {
                        s.y = mapH - minDistance;
                    }

                    // Prevent overlapping with other letters
                    for (let j = 0; j < letters.length; j++) {
                        if (i !== j){
                            let other = letters[j];
                            let dx2 = s.x - other.x;
                            let dy2 = s.y - other.y;
                            let d = Math.sqrt(dx2*dx2 + dy2*dy2);

                            if (d < minDistance && d > 0) {
                                let ux2 = dx2 / d;
                                let uy2 = dy2 / d;
                                let overlap = minDistance - d;
                                s.x += ux2 * overlap * 0.5;
                                s.y += uy2 * overlap * 0.5;
                                other.x -= ux2 * overlap * 0.5;
                                other.y -= uy2 * overlap * 0.5;
                            }
                        }
                    }
                    
                    // send the updated letters positions
                    socket.emit("push-letters", letters);
                } else {
                    // letters drawing
                    push();
                        translate(width/2 + mapX, height/2 + mapY);
                        
                        // If the letter is used in a possible animal, glow green
                        if (lettersUsedInAnimals.has(s.letter.toUpperCase())) {
                            fill(0, 255, 0);
                            stroke(0, 200, 0);
                            strokeWeight(2);
                        } else {
                            fill(194, 178, 128);
                            noStroke();
                        }

                        textSize(16);
                        textAlign(CENTER, CENTER);
                        text(s.letter, s.x, s.y);
                    pop();
                }
            }

            // Get letters currently visible on the screen
            const visibleLetters = letters.filter(l => {
                const screenX = l.x + width/2 + mapX;
                const screenY = l.y + height/2 + mapY;
                return screenX > 0 && screenX < width && screenY > 0 && screenY < height;
            });

            // Convert to string
            const currentLetters = visibleLetters.map(l => l.letter).join(' ');

            // Only record if changed
            if (currentLetters !== lastVisibleLetters) {
                // keep track of current letters
                lastVisibleLetters = currentLetters;
                // console.log("Letters in view:", currentLetters);

                const lettersArray = visibleLetters.map(l => l.letter.toUpperCase());

                // Find possible animals
                const possibleAnimals = animalNames.filter(name => canFormWord(name, lettersArray));
                console.log("Possible animals:", possibleAnimals);

                // For each possible animal, find which letters are used
                lettersUsedInAnimals.clear();
                for (let animal of possibleAnimals) {
                    let tempLetters = [...lettersArray];
                    for (let char of animal) {
                        const index = tempLetters.indexOf(char);
                        if (index !== -1) {
                            lettersUsedInAnimals.add(char);
                            tempLetters.splice(index, 1);
                        }
                    }
                }
                // console.log("Letters used in possible animals:", Array.from(lettersUsedInAnimals).join(', '));
            }

        //

        // My avatar (static)
            push();
                translate(3 * width/8, 3 * height/8);
                scale(0.25);
                drawAvatar(myDrawingPoints, myUsername);
            pop();

        // U-shaped Scoop in front of Avatar
            push();
                translate(width/2, height/2);
                
                // convert tilt to an angle
                let angle = atan2(beta, gamma);
                let stemLength = 60;
                let scoopWidth = 60;
                let scoopDepth = 30;

                rotate(angle);
                stroke(0, 150, 0);
                strokeWeight(4);
                noFill();
                line(20, 0, stemLength - scoopDepth, 0);
                beginShape();
                    vertex(stemLength, scoopWidth / 2);
                    bezierVertex(stemLength - scoopDepth, scoopWidth / 2,
                                stemLength - scoopDepth, - scoopWidth / 2,
                                stemLength, - scoopWidth / 2);
                endShape();

            pop();

        // if moved send location to server
        if (mapX !== lastMapX || mapY !== lastMapY) {
            socket.emit("update-location", { userId: myUserId, x: mapX, y: mapY });

            lastMapX = mapX;
            lastMapY = mapY;
            // console.log("location changed");
        }
        
    } else {
        document.querySelector('#requestOrientationButton').style.display = "none";
    }
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

socket.on("location-update", function (data) {
    if (otherPlayers[data.userId]) {
        otherPlayers[data.userId].x = - data.x;
        otherPlayers[data.userId].y = - data.y;
    }
    console.log("change of location",otherPlayers);
});

socket.on("letters-create", function (particles) {
    letters = particles;
});

socket.on("animal-list", (names) => {
    console.log("Available animals:", names);
    animalNames = names.map(n => n.toUpperCase());
});

/* ------------------------------------ */
// FUNCTIONS:

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

function canFormWord(word, availableLetters) {
    const lettersCopy = [...availableLetters];
    for (let char of word) {
        const index = lettersCopy.indexOf(char);
        if (index === -1) return false;
        lettersCopy.splice(index, 1);
    }
    return true;
}
