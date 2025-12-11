/* ------------------------------------ */
// NAME PAGE
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');
const myUserId = getOrCreateUserId();
console.log('My userId:', myUserId);

// check if client has a username already
let myUsername = localStorage.getItem("chat-username");
if(myUsername){
    console.log("my username is", myUsername);
    nameInput.value = myUsername;
} else {
    myUsername = "";
}

// submitting name to server
nameSubmit.addEventListener('click', sendName);
nameInput.addEventListener('keyup', function (e) {
    if (e.key === 'Enter') sendName();
});

// submitting avatar to server
const avatarSubmit = document.getElementById("avatarSubmit");
avatarSubmit.addEventListener("click", submitAvatar);

const clearAvatar = document.getElementById("clearAvatar");
clearAvatar.addEventListener("click", function() {
    myDrawingPoints = [];
});

// convinience arrow key movement
window.addEventListener('keydown', function(e) {
    switch(e.key){
        case "ArrowLeft":  moveLeft = true; break;
        case "ArrowRight": moveRight = true; break;
        case "ArrowUp":    moveUp = true; break;
        case "ArrowDown":  moveDown = true; break;
    }
});
window.addEventListener('keyup', function (e) {
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
let mapW = 3000;
let mapH = 3000;
let lastGamma = 0;
let lastBeta = 0;
let lastGrabbing = false;

// map objects
let otherPlayers = {};
let foundAnimals = [];

// letters
let letters = [];
let minDistance = 25;
let animalNames = [];
let lastPossibleAnimalsString = "";
const orderXThreshold = 100;
const orderYThreshold = 80;
let visibleAnimalMatches = []; 

// XY-Coodinates of user & map
let mapX = 0;
let mapY = 0;
let moveScale = 1;
let lastMapX = null;
let lastMapY = null;
const tiltSensitivity = 0.1;
const maxSpeed = 10; 
let userX = 0;
let userY = 0;
let actualMapX = 0;
let actualMapY = 0;

// Convinience control testing
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;

// Claw Setting
let grabbing = false;
let grabbedLetter = null;
let lastLetterPositions = new Map();

// Choosing box
let wordTapped = false;
let selectedAnimalIndex = null;

let ripples = []; 
let lastClusterRippleTime = 0;
const clusterRippleInterval = 1000; 

let lastLetterUpdateTime = 0;
const letterUpdateInterval = 200;
let lastActualMapX = null;
let lastActualMapY = null;


let showInstructions = true;
let lastButtonPressTime = 0;
const instructionTimeout = 300000;

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("p5-canvas-container");
}

function draw(){  
    background(255);

    /* ------------------------------------ */
    // AVATAR SECTION
    if (isDrawing){
        toggleAvatarButtons(true);

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
        drawAvatar(myDrawingPoints, false);
    } else {
        toggleAvatarButtons(false);
    }

    /* ------------------------------------ */
    // MAP SECTION
    if (showMap == true){
        // Movement Condition:
            // how much tilt to move direction
            let speedX = 0;
            if (round(gamma) > 5){
                // console.log('the user is moving right');
                speedX = gamma * tiltSensitivity;
            } 
            if (round(gamma) < -5){
                // console.log('the user is moving left');
                speedX = gamma * tiltSensitivity;
            }
            speedX = constrain(speedX, -maxSpeed, maxSpeed);
            mapX -= speedX;

            let speedY = 0;
            if (round(beta) > 5){
                // console.log('the user is moving dowm');
                speedY = beta * tiltSensitivity;
            }
            if (round(beta) < -5){
                // console.log('the user is moving up');
                speedY = beta * tiltSensitivity;
            }
            speedY = constrain(speedY, -maxSpeed, maxSpeed);
            mapY -= speedY;

            if (mapX > 0) {
                mapX = mapX - mapW;
            } else if (mapX < -mapW) {
                mapX = mapX + mapW;
            }

            if (mapX > -width / 2) {
                actualMapX = -width / 2;
                userX = -mapX;
            } else if (mapX < -mapW + width / 2) {
                actualMapX = -mapW + width / 2;
                userX = width - (mapW + mapX);
            } else {
                actualMapX = mapX;
                userX = width / 2;
            }

            if (mapY > 0) {
                mapY = mapY - mapH;
            } else if (mapY < -mapH) {
                mapY = mapY + mapH;
            }

            if (mapY > -height / 2) {
                actualMapY = -height / 2;
                userY = -mapY;
            } else if (mapY < -mapH + height / 2) {
                actualMapY = -mapH + height / 2;
                userY = height - (mapH + mapY);
            } else {
                actualMapY = mapY;
                userY = height / 2;
            }   

            // Draw map (moving)
            push();
                translate(width/2 + actualMapX, height/2 + actualMapY);
                fill(14, 99, 107);
                rect(0 , 0, mapW, mapH);

                // draw other players
                for (let userId in otherPlayers) {
                    let p = otherPlayers[userId];
             
                    push();
                        translate( - width/8, - height/8);
                        translate(-p.x, -p.y); 
                        scale(0.25);
                        noFill();
                        stroke(0);
                        drawAvatar(p.drawing, p.username, true);
                    pop();

                    push();
                        let angle = 0;
                        if (p.gamma !== undefined && p.beta !== undefined) {
                            angle = atan2(-p.gamma, p.beta);
                        }
                        translate(-p.x, -p.y); 
                        rotate(angle);
                        stroke(0);
                        drawClaw(p.grabbing);
                    pop();
                }

                // draw all found animals
                for (let a of foundAnimals) {
                    push();
                        translate(a.x, a.y);
                        stroke(0);
                        drawAnimal(a.info);
                    pop();
                }                
            pop();

        // Ripples
            if (millis() - lastClusterRippleTime > clusterRippleInterval) {
                for (let match of visibleAnimalMatches) {
                    // Compute cluster center in screen coordinates
                    let sumX = 0;
                    let sumY = 0;
                    for (let pos of match.positions) {
                        sumX += pos.x;
                        sumY += pos.y;
                    }
                    let centerX = sumX / match.positions.length;
                    let centerY = sumY / match.positions.length;
            
                    // Create ripple at cluster center
                    ripples.push(new Ripple(centerX, centerY));
                }
                lastClusterRippleTime = millis();
            }
    
            for (let i = ripples.length - 1; i >= 0; i--) {
                push();
                translate(width/2 + actualMapX, height/2 + actualMapY); // apply map offset here
                ripples[i].update();
                ripples[i].show();
                pop();
                if (ripples[i].finished()) {
                    ripples.splice(i, 1);
                }
            }

        // Claw
            // Draw grab button at bottom center
            if (grabbing == false){
                fill(50, 205, 50);
            } else {
                fill(220, 20, 60);
            }
            stroke(0);
            strokeWeight(2);
            circle(width/2, height - 100, 80);

            // Draw instruction above the button
            if (showInstructions) {
                noStroke();
                fill(255);
                textAlign(CENTER, CENTER);
                textSize(15);
                text("Press the button to control the Y‑claw", width/2, height - 180);
                text("nd grab or move letters around!:", width/2, height - 160);
            }

            // Auto-hide instructions after 1 minute of inactivity
            if (!grabbing && millis() - lastButtonPressTime > instructionTimeout) {
                showInstructions = true;
            }

            fill(0);
            noStroke();
            textAlign(CENTER, CENTER);
            textSize(16);
            text("GRAB", width/2, height - 100);
        

            push();
                translate(userX, userY);
                let angle = atan2(-gamma, beta);
                rotate(angle);
                stroke(255, 100, 0);
                drawClaw(grabbing);
            pop();
        
        // My avatar (static)
            push();
                translate(userX - width/8, userY - height/8);
                scale(0.25);
                noFill();
                stroke(255, 100, 0);
                drawAvatar(myDrawingPoints, myUsername, true);
            pop();

        // Letter drawing & conditions
            for (let i = 0; i < letters.length; i++) {
                let s = letters[i];
                
                let offset = 5;

                // If a letter is grabbed, move it to the tip of the claw
                if (grabbing && grabbedLetter) {
                    // angle of claw (already used for drawing)
                    let angle = atan2(-gamma, beta);
                
                    // Tip of claw relative to its base (0,0)b
                    let tip = createVector(0, 70); // 70 = claw arm length
                    tip.rotate(angle);
                
                    // Position in map coordinates
                    grabbedLetter.x = tip.x - actualMapX - (width/2 - userX);
                    grabbedLetter.y = tip.y - actualMapY - (height/2 - userY);
                }
                
                const mapMoved = (actualMapX !== lastActualMapX) || (actualMapY !== lastActualMapY);
                if (mapMoved && (millis() - lastLetterUpdateTime > letterUpdateInterval)) {
                    updateMatchingLetters();
                    checkWordClusterTap(userX, userY);
                    lastLetterUpdateTime = millis();
                    lastActualMapX = actualMapX;
                    lastActualMapY = actualMapY;
                }

                // keep letters inside map
                if (s.x < offset) {
                    s.x = minDistance;
                }
                if (s.x > mapW - offset) {
                    s.x = mapW - minDistance;
                }
                if (s.y < offset) {
                    s.y = minDistance;
                }
                if (s.y > mapH - offset) {
                    s.y = mapH - minDistance;
                }

                // prevent overlapping with other letters
                for (let j = 0; j < letters.length; j++) {
                    if (i !== j){
                        let other = letters[j];
                        let dx2 = s.x - other.x;
                        let dy2 = s.y - other.y;
                        let d = Math.sqrt(dx2*dx2 + dy2*dy2);

                        // if letters are too close
                        if (d < minDistance && d > 0) {
                            let ux2 = dx2 / d;
                            let uy2 = dy2 / d;
                            let overlap = minDistance - d;

                            // push them away from each other
                            s.x += ux2 * overlap * 0.5;
                            s.y += uy2 * overlap * 0.5;
                            other.x -= ux2 * overlap * 0.5;
                            other.y -= uy2 * overlap * 0.5;
                        }
                    }
                }

                // letters drawing
                push();
                    translate(width/2 + actualMapX, height/2 + actualMapY);
                    
                    // check if this letter is part of any visible animal match
                    let isMatched = false;
                    for (let match of visibleAnimalMatches) {
                        if (match.letterIndices.includes(i)) {
                            isMatched = true;
                            break;
                        }
                    }

                    // color change dependented upon
                    if (isMatched) {
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
                
                if (grabbing && grabbedLetter) {
                    for (let i = 0; i < letters.length; i++) {
                        const letter = letters[i];
                        
                        // get last recorded position
                        const lastPos = lastLetterPositions.get(i);
                    
                        // check if the position has changed
                        if (!lastPos || 
                            Math.abs(letter.x - lastPos.x) > 6 || 
                            Math.abs(letter.y - lastPos.y) > 6
                        ) {
                            // position changed → log and send to server
                            // console.log(`Letter '${letter.letter}' moved:`, { x: letter.x, y: letter.y });
                            socket.emit("push-letters", { index: i, x: Math.round(letter.x * 10) / 10, y: Math.round(letter.y * 10) / 10 });
                    
                            // update last position
                            lastLetterPositions.set(i, { x: letter.x, y: letter.y });
                        }
                    }
                }
            }
        
        // if moved send location to server
            if (Math.abs(mapX - lastMapX) > 1 || 
                Math.abs(mapY - lastMapY) > 1 ||
                Math.abs(lastGamma - gamma) > 2 || 
                Math.abs(lastBeta - beta) > 2 ||
                grabbing !== lastGrabbing
            ) {
                socket.emit("update-location", { 
                    userId: myUserId, 
                    x: mapX, 
                    y: mapY,
                    g: gamma,
                    b: beta,
                    grabbing
                });

                // SAVE LOCALLY
                localStorage.setItem("saved-map-pos", JSON.stringify({ 
                    x: mapX, 
                    y: mapY 
                }));

                lastMapX = mapX;
                lastMapY = mapY;
                lastGamma = gamma;
                lastBeta = beta;
                lastGrabbing = grabbing;
                // console.log("location changed");
            }

        // Testing for multiple devices:
            // computer arrow control rotation
            if(beta === undefined)  beta = 0;
            if(gamma === undefined) gamma = 0;
            if(moveRight)   { gamma ++; }
            if(moveLeft)    { gamma --; }
            if(moveUp)      { beta  --; }
            if(moveDown)    { beta  ++; }

        // info
        if (wordTapped) {
            drawTabBox();

            // if there is no animal in sight anymore close tab
            if (visibleAnimalMatches.length === 0) {
                wordTapped = false;
                // console.log("Tab closed automatically: no possible animals left");
            }
        } 
    }
}

/* ------------------------------------ */
// SOCKETS:
if(location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')){
    socket = io({path: "/lucas/port-4230/socket.io"});
}else{
    socket = io(); 
}

socket.on('new-avatar', function (avatars) {
    console.log('New avatar received from another user:', avatars);
    otherPlayers[avatars.userId] = avatars;
});

socket.on("location-update", function (data) {
    if (otherPlayers[data.userId]) {
        otherPlayers[data.userId].x = data.x;
        otherPlayers[data.userId].y = data.y;
        otherPlayers[data.userId].gamma = data.g;
        otherPlayers[data.userId].beta = data.b;
        otherPlayers[data.userId].grabbing = data.grabbing;
    }
    // console.log("change of location", otherPlayers);
});

socket.on("letters-create", function (particles) {
    letters = particles.map(l => ({ ...l, selected: false }));
});

socket.on("letters-moved", (data) => {
    const { index, x, y } = data;
    if (letters[index]) {
        letters[index].x = x;
        letters[index].y = y;
    }
    updateMatchingLetters();
});

socket.on("animal-list", (names) => {
    console.log("Available animals:", names);
    animalNames = names.map(n => n.toUpperCase());
});

socket.on("animal-found", (data) => {
    console.log("Animal found:", data);
    foundAnimals.push(data);
});

socket.on("restore-animals", function(animals){
    animals.forEach(a => {
        foundAnimals.push(a);
    });
});

socket.on("animals-update", (serverAnimals) => {
    // serverAnimals is an array in the same order as history.animals
    for (let i = 0; i < serverAnimals.length; i++) {

        // If client doesn’t know this animal yet (e.g., rejoin)
        if (!foundAnimals[i]) {
            foundAnimals[i] = serverAnimals[i];
            continue;
        }

        // Update ONLY position  
        foundAnimals[i].x = serverAnimals[i].x;
        foundAnimals[i].y = serverAnimals[i].y;
    }
});

/* ------------------------------------ */
// FUNCTIONS:

function touchStarted() {
    if (isDrawing) {
        myDrawingPoints.push([]);
    }
    
    if (showMap){
        // Check if GRAB button is pressed
        for (let t of touches) {
            const touchX = t.x;
            const touchY = t.y;

            if (wordTapped) {
                const boxWidth = 300;
                const numColumns = 2;
                const columnPadding = 10;
                const rowPadding = 5;
                const rowHeight = 22;
                const paddingTop = 35;
                const paddingBottom = 80;
                const numRows = Math.ceil(visibleAnimalMatches.length / 2);
                const boxHeight = paddingTop + numRows * rowHeight + paddingBottom;
                const boxX = width/2 - boxWidth/2;
                const boxY = height/2 - boxHeight/2;
                
                const closeSize = 20;
                const closeX = boxX + boxWidth - closeSize - 5;
                const closeY = boxY + 5;

                if (touchX >= closeX && touchX <= closeX + closeSize &&
                    touchY >= closeY && touchY <= closeY + closeSize) {
                    wordTapped = false;
                    console.log("Tab closed via touch");
                    return;
                }

                // List of animals (tap detection)
                const columnWidth = (boxWidth - columnPadding * (numColumns + 1)) / numColumns;

                for (let i = 0; i < visibleAnimalMatches.length; i++) {
                    const col = i % numColumns;
                    const row = Math.floor(i / numColumns);
            
                    // full touch area includes the empty space to the right of the text
                    const xStart = boxX + columnPadding + col * ((boxWidth - 3 * columnPadding) / numColumns + columnPadding) - 20;
                    const yStart = boxY + paddingTop + row * (rowHeight + rowPadding);
                    const xEnd = xStart + (boxWidth - 3 * columnPadding) / numColumns + 10;
                    const yEnd = yStart + rowHeight;
            
                    const t = touches[0]; // for simplicity, just take the first touch
                    if (t.x >= xStart && t.x <= xEnd && t.y >= yStart && t.y <= yEnd) {
                        selectedAnimalIndex = i;
                        // stop here so one tap selects immediately
                        return;
                    }  
                }

                // Submit button 
                const submitHeight = 30, submitWidth = boxWidth - 20;
                const submitX = boxX + 10, submitY = boxY + boxHeight - submitHeight - 10;
                if (touchX >= submitX && touchX <= submitX + submitWidth && 
                    touchY >= submitY && touchY <= submitY + submitHeight
                ) {
                    if (selectedAnimalIndex !== null) { 
                        console.log("Selected animal:", visibleAnimalMatches[selectedAnimalIndex].animal); 
                        
                        const selectedAnimal = visibleAnimalMatches[selectedAnimalIndex];
                        for (let idx of selectedAnimal.letterIndices) {
                            letters[idx].x = random(minDistance, mapW - minDistance);
                            letters[idx].y = random(minDistance, mapH - minDistance);

                            // Send immediately to server
                            socket.emit("push-letters", { 
                                index: idx, 
                                x: Math.round(letters[idx].x * 10) / 10, 
                                y: Math.round(letters[idx].y * 10) / 10 
                            });
                        }

                        let sumX = 0, sumY = 0;
                        for (let pos of selectedAnimal.positions) {
                            sumX += pos.x;
                            sumY += pos.y;
                        }
                        const centerX = sumX / selectedAnimal.positions.length;
                        const centerY = sumY / selectedAnimal.positions.length;

                        socket.emit("found-animal", {
                            animal: selectedAnimal.animal,
                            x: centerX,
                            y: centerY
                        });

                        wordTapped = false;
                        selectedAnimalIndex = null;
                    }
                }
            }

            let btnX = width / 2;
            let btnY = height - 100;
            let btnRadius = 40;
            let d = dist(touchX, touchY, btnX, btnY);

            if (d < btnRadius && !wordTapped) {
                grabbedLetter = getClosestLetterToClaw();

                if(grabbing == false ){
                    grabbing = true;
                    console.log("grabbing state:", grabbedLetter);
                } else {
                    grabbing = false;
                    console.log("grabbing state: released");
                    grabbedLetter = null;
                }
                lastButtonPressTime = millis();
                showInstructions = false;
            } else {
                checkWordClusterTap(touchX, touchY);
            }
        }
    }
}

function touchMoved() {
    if (isDrawing){
        for (let t of touches) {
            let dx = t.x - width/2;
            let dy = t.y - height/2;
            let r = 150;
            let distFromCenter = sqrt(dx*dx + dy*dy);

            if (distFromCenter > r) {
                // Clamp point to edge of circle
                let angle = atan2(dy, dx);
                t.x = width/2 + cos(angle) * r;
                t.y = height/2 + sin(angle) * r;
            }

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

    // load avatar
    loadAvatarLocally();
}

function toggleAvatarButtons(displays) {
    if (displays == true){
        avatarSubmit.style.display = "block";
        clearAvatar.style.display = "block";
    } else {
        avatarSubmit.style.display = "none";
        clearAvatar.style.display = "none";
    }
}

function submitAvatar() {
    // remove empty stroke arrays
    const cleanedDrawing = myDrawingPoints.filter(strokeArr => strokeArr.length > 0);

    // send avatar data to the server
    socket.emit("submit-avatar", cleanedDrawing);
    console.log('Avatar submitted!', cleanedDrawing);

    // save locally
    saveAvatarLocally();

    // stop drawing avatar
    isDrawing = false;
    toggleAvatarButtons(true);

    // Load last recorded map position
    let savedPos = localStorage.getItem("saved-map-pos");
    if (savedPos) {
        savedPos = JSON.parse(savedPos);
        mapX = savedPos.x;
        mapY = savedPos.y;
    } else {
        // no saved position yet → start at 0,0
        mapX = width/2;
        mapY = height/2;
    }

    // start showing the map
    showMap = true;

    // request orientation
    requestOrientation();
}

function drawAvatar(drawing, username = "", showLegs) {
    // avatar
    drawingContext.setLineDash([]);
    strokeWeight(10);

    push();
    if (showLegs) {
        translate(width/2, height/2);
        scale(4);
        if (!drawing.spiderLegs) {
            drawing.spiderLegs = new SpiderLegs(); 
        }
        drawing.spiderLegs.update();
        drawing.spiderLegs.show();
    }
    pop();

    
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

function saveAvatarLocally() {
    if (myDrawingPoints.length > 0) {
        const cleanedDrawing = myDrawingPoints.filter(strokeArr => strokeArr.length > 0);
        localStorage.setItem("my-avatar", JSON.stringify(cleanedDrawing));
        console.log("Avatar saved locally!");
    }
}

function loadAvatarLocally() {
    const saved = localStorage.getItem("my-avatar");
    if (saved) {
        myDrawingPoints = JSON.parse(saved);
        console.log("Loaded avatar from local storage!");
        toggleAvatarButtons(true); // show submit/clear buttons
    }
}

function requestOrientation() {
    // from: https://dev.to/li/how-to-requestpermission-for-devicemotion-and-deviceorientation-events-in-ios-13-46g2

    // feature detect
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
            if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
            }
        })
        .catch(console.error);
    } else {
        // handle regular non iOS 13+ devices
        window.addEventListener('deviceorientation', handleOrientation, true);
    }
}

function handleOrientation(eventData){
    // console.log(eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;
}

function drawAnimal(a) {
    let elements = [];

    // Helper to safely push elements if their main array exists
    function pushElements(type, obj, mainKey) {
        if (obj?.[mainKey]?.length) {
            for (let i = 0; i < obj[mainKey].length; i++) {
                elements.push({ type, ...obj, index: i });
            }
        }
    }

    pushElements("rect", a.rect, "x");
    pushElements("ellipse", a.ellipse, "x");
    pushElements("triangle", a.triangle, "x1");
    pushElements("line", a.line, "x1");
    pushElements("bezier", a.bezier, "x1");

    // Sort by order safely
    elements.sort((x, y) => (x.order?.[x.index] || 0) - (y.order?.[y.index] || 0));

    // Draw elements safely
    for (let e of elements) {
        try {
            switch (e.type) {
                case "rect":
                    if (e.rgb?.[e.index] && e.x?.[e.index] != null) {
                        noStroke();
                        fill(...e.rgb[e.index]);
                        rect(e.x[e.index], e.y[e.index], e.w[e.index], e.h[e.index], e.r?.[e.index] || 0);
                    }
                    break;
                case "ellipse":
                    if (e.rgb?.[e.index] && e.x?.[e.index] != null) {
                        noStroke();
                        fill(...e.rgb[e.index]);
                        ellipse(e.x[e.index], e.y[e.index], e.w[e.index], e.h[e.index]);
                    }
                    break;
                case "triangle":
                    if (e.rgb?.[e.index] && e.x1?.[e.index] != null) {
                        noStroke();
                        fill(...e.rgb[e.index]);
                        triangle(
                            e.x1[e.index], e.y1[e.index],
                            e.x2[e.index], e.y2[e.index],
                            e.x3[e.index], e.y3[e.index]
                        );
                    }
                    break;
                case "line":
                    if (e.rgb?.[e.index] && e.x1?.[e.index] != null) {
                        stroke(...e.rgb[e.index]);
                        strokeWeight(2);
                        line(e.x1[e.index], e.y1[e.index], e.x2[e.index], e.y2[e.index]);
                    }
                    break;
                case "bezier":
                    if (e.rgb?.[e.index] && e.x1?.[e.index] != null) {
                        strokeWeight(2);
                        if (e.filled?.[e.index]) {
                            fill(...e.rgb[e.index]);
                            noStroke();
                            beginShape();
                            vertex(e.x1[e.index], e.y1[e.index]);
                            bezierVertex(e.cx1[e.index], e.cy1[e.index], e.cx2[e.index], e.cy2[e.index], e.x2[e.index], e.y2[e.index]);
                            endShape(CLOSE);
                        } else {
                            noFill();
                            stroke(...e.rgb[e.index]);
                            bezier(e.x1[e.index], e.y1[e.index], e.cx1[e.index], e.cy1[e.index], e.cx2[e.index], e.cy2[e.index], e.x2[e.index], e.y2[e.index]);
                        }
                    }
                    break;
            }
        } catch (err) {
            console.warn("Skipped drawing element due to missing data:", e, err);
        }
    }
}

function drawClaw(isGrabbing) {
    strokeWeight(4);
    noFill();
    
    // Claw rope/arm
    line(0, 0, 0, 50);
    
    // Claw arms
    if (isGrabbing == false) {
        line(0, 50, - 20, 70);
        line(0, 50, 20, 70);
    } else {
        // If holding something, close the claw
        line(0, 50, - 5, 70);
        line(0, 50, 5, 70);
    }
}

function getClosestLetterToClaw() {
    let closest = null;
    let minDist = Infinity;
    let closestIndex = -1;
    const grabDistance = 30;

    // angle of claw
    let angle = atan2(-gamma, beta);

    // claw tip relative to center
    let tip = createVector(0, 70); // 70 = claw arm length
    tip.rotate(angle);

    // claw tip in screen coordinates
    const clawTipX = userX + tip.x;
    const clawTipY = userY + tip.y;

    for (let i = 0; i < letters.length; i++) {
        let l = letters[i];
        let screenX = l.x +  width/2 + actualMapX;;
        let screenY = l.y + height/2 + actualMapY;
        let d = dist(clawTipX, clawTipY, screenX, screenY);

        if (d < minDist) {
            minDist = d;
            closest = l;
            closestIndex = i;
        }
    }

    if (closest && minDist <= grabDistance) {
        console.log("closest:" + closest);
        return closest;
    } else {
        return null;
    }
}

function updateMatchingLetters() {
    // Step 1: letters visible on screen
    const visibleLetters = letters.map((l, i) => ({
        letter: l.letter.toUpperCase(),
        x: l.x,
        y: l.y,
        index: i
    })).filter(l => {
        const screenX = l.x + width/2 + actualMapX;
        const screenY = l.y + height/2 + actualMapY;
        return screenX > 0 && screenX < width && screenY > 0 && screenY < height;
    });

    // Step 2: find animals that can be formed with visible letters
    const availableLetters = visibleLetters.map(l => l.letter);
    const possibleAnimals = animalNames.filter(name => canFormWord(name, availableLetters));
    const possibleAnimalsStr = possibleAnimals.slice().sort().join(",");
    if (possibleAnimalsStr !== lastPossibleAnimalsString) {
        // console.log("Possible animals:", possibleAnimals);
        lastPossibleAnimalsString = possibleAnimalsStr;

        /// Step 3: cluster letters for each possible animal
        visibleAnimalMatches = [];
        for (let animal of possibleAnimals) {
            // collect all letters for this animal
            const animalLetters = [];
            for (let char of animal) {
                const candidates = visibleLetters.filter(l => l.letter === char);
                animalLetters.push(candidates);
            }

            // find a cluster without reusing the same letter instance
            const clusterMatch = findClusterUnique(animalLetters);
            if (clusterMatch) {
                visibleAnimalMatches.push({
                    animal,
                    letterIndices: clusterMatch.map(l => l.index),
                    positions: clusterMatch.map(l => ({ x: l.x, y: l.y }))
                });
                // console.log(`Animal matched: ${animal}`, clusterMatch.map(l => l.letter));
            }
        }
    } 
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

function findClusterUnique(letterOptions, current = [], usedIndices = new Set(), depth = 0) {
    if (depth === letterOptions.length) {
        // check proximity between consecutive letters
        for (let i = 1; i < current.length; i++) {
            const dx = Math.abs(current[i].x - current[i - 1].x);
            const dy = Math.abs(current[i].y - current[i - 1].y);
            if (dx > orderXThreshold || dy > orderYThreshold) return null;
        }
        return current;
    }

    for (let candidate of letterOptions[depth]) {
        if (usedIndices.has(candidate.index)) continue;

        usedIndices.add(candidate.index);
        const nextCurrent = current.concat(candidate);
        const result = findClusterUnique(letterOptions, nextCurrent, usedIndices, depth + 1);
        if (result) return result;
        usedIndices.delete(candidate.index);
    }

    return null;
}

function checkWordClusterTap(x, y) {
    if (!wordTapped) {
        for (let match of visibleAnimalMatches) {
            // Compute cluster center
            let sumX = 0;
            let sumY = 0;
            for (let pos of match.positions) {
                sumX += pos.x + width/2 + actualMapX;
                sumY += pos.y + height/2 + actualMapY;
            }
            let centerX = sumX / match.positions.length;
            let centerY = sumY / match.positions.length;

            // radius around center to detect tap
            let radius = 50;
            let d = dist(x, y, centerX, centerY);
            if (d <= radius) {
                wordTapped = true;
                console.log("Cluster:", wordTapped);

                // automatically select first animal option
                if (visibleAnimalMatches.length > 0) {
                    selectedAnimalIndex = 0;
                }

                return;
            }
        }
    }
}

function drawTabBox() {
    const boxWidth = 300;

    // Compute rows based on 2 columns
    const numRows = Math.ceil(visibleAnimalMatches.length / 2);
    const rowHeight = 22;
    const paddingTop = 35;
    const paddingBottom = 80; // space for submit button
    const boxHeight = paddingTop + numRows * rowHeight + paddingBottom;

    const boxX = width/2 - boxWidth/2;
    const boxY = height/2 - boxHeight/2;

    fill(240); 
    stroke(0); 
    strokeWeight(1);
    rect(boxX, boxY, boxWidth, boxHeight, 10);

    // Close button
    const closeSize = 20;
    const closeX = boxX + boxWidth - closeSize - 5;
    const closeY = boxY + 5;
    fill(255, 100, 100); rect(closeX, closeY, closeSize, closeSize, 5);
    fill(0); textSize(16); textAlign(CENTER, CENTER);
    text("X", closeX + closeSize/2, closeY + closeSize/2);

    // Title
    fill(0);
    textSize(18);
    textAlign(LEFT, TOP);
    text("Possible Animals:", boxX + 10, boxY + 10);

    // Instruction
    textSize(14);
    fill(80);
    text("Click animal name to select an animal", boxX + 10, boxY + 30);

    // List animals in 2 columns
    const columnWidth = (boxWidth - 30) / 2; // spacing between columns
    textSize(16);
    textAlign(LEFT, TOP);

    for (let i = 0; i < visibleAnimalMatches.length; i++) {
        let animal = visibleAnimalMatches[i].animal;
        let col = i % 2; // 0 = left, 1 = right
        let row = Math.floor(i / 2);

        let x = boxX + 10 + col * columnWidth;
        let y = boxY + 50 + row * rowHeight;

        if (i === selectedAnimalIndex) {
            fill(0, 100, 200);
            textSize(18);
            text(">>", x, y);
            text(animal, x + 30, y);
        } else {
            fill(100);
            textSize(18);
            text(animal, x, y);
        }
        
    }
    
    // Submit button
    const submitHeight = 30, submitWidth = boxWidth - 20;
    const submitX = boxX + 10, submitY = boxY + boxHeight - submitHeight - 10;
    fill(50, 205, 50);
    rect(submitX, submitY, submitWidth, submitHeight, 5);
    fill(0); 
    textSize(18); 
    textAlign(CENTER, CENTER);
    text("SUBMIT", submitX + submitWidth/2, submitY + submitHeight/2);
}

class Ripple {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 0;
      this.alpha = 80;
    }
  
    update() {
      this.radius += 1;
      this.alpha -= 1;
    }
  
    finished() {
      return this.alpha <= 0;
    }
  
    show() {
      noFill();
      stroke(0, 150, this.alpha);
      strokeWeight(2);
      ellipse(this.x, this.y, this.radius * 2);
    }
}

class SpiderLegs {
    constructor(legCount = 8, legLength = 50) {
        this.legs = [];
        this.legCount = legCount;
        this.legLength = legLength;
        for (let i = 0; i < legCount; i++) {
            let angle = map(i, 0, legCount, 0, TWO_PI);
            this.legs.push({
                baseAngle: angle,
                swing: 0,
                swingSpeed: random(0.05, 0.1),
                swingRange: PI / 6
            });
        }
    }

    update() {
        for (let leg of this.legs) {
            leg.swing = sin(frameCount * leg.swingSpeed) * leg.swingRange;
        }
    }

    show() {
        for (let leg of this.legs) {
            push();
            rotate(leg.baseAngle + leg.swing);
            fill(255);
            noStroke();
            circle(0,0, 60);
            stroke(255);
            strokeWeight(3);
            line(0, 0, this.legLength, 0);
            pop();
        }
    }
}