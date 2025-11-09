// Map Setup
let mappa = new Mappa('Leaflet'); // map library
let myMap;
let canvas;
let currentLongitude  = 0; // global variables will be updated as we get GPS data
let currentLatitude   = 0; // global variables will be updated as we get GPS data
let mapInit = false; // we only do map stuff once mapInit is true (see in draw)
let me;                     // point object showing our own location
let otherPlayers = {};


// let socket = io();

if (location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')) {
  socket = io({ path: "/lucas/port-4230/socket.io" });
} else {
  socket = io();
}

// setup default data of location and zoom (will change once given data)
let mappa_options = {
  lat: 0,
  lng: 0,
  zoom: 16,

  // there are differnt suppliers and styles of maps available
  // options for map styles:
    // style: "https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
    // style: "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
  style: 'https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}',
}

/*----------------------------------------------*/
// Game Setup
let myName = '';
let codeSize = 8;

// CODE SETUP
let randomCode; 
let isEnteringCode = false;
let userTapSequence = [];
let codeFeedback = "";
let codeFeedbackColor;
let codeFeedbackTime = 0;
const FEEDBACK_DURATION = 3000;

// Notifications
let notificationText = "";
let notificationStartTime = 0;
const NOTIFICATION_DURATION = 4000;

// Zones/Squares
let zones = [];
let zoneNumbers = [];
let gridRows = 4;
let gridCols = 4;
let zoneSize = 0.0016;

// Endgame
let gameEnded = false;
let endGameMessage = "";
let winnerName = "";
let winnerCode = [];

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  
  // Draw this user player point
  me = new PlayerPoint(currentLatitude, currentLongitude, myName, true);
  
  // default
  codeFeedbackColor = color(0);
}

function draw() {
  clear();

  // Initialize full screen map
  // runs only once to init map
  if(!mapInit && GPS_GRANTED && currentLongitude!= 0){
    console.log("starting map");
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    myMap = mappa.tileMap(mappa_options); 
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;

    // Show ready button
    readyButton.style.display = 'block';
  }

  // When Map is intialized, draw users on map
  if(mapInit){
    // Draw the zones first
    for (let z of zones) {
      // Corners of the zones
      let topLeft = myMap.latLngToPixel(z.lat + zoneSize / 2, z.lon - zoneSize / 2);
      let bottomRight = myMap.latLngToPixel(z.lat - zoneSize / 2, z.lon + zoneSize / 2);    
    
      // Calculating the x, y, w, h for rectangle
      let top = min(topLeft.y, bottomRight.y);
      let left = min(topLeft.x, bottomRight.x);
      let w = abs(bottomRight.x - topLeft.x);
      let h = abs(bottomRight.y - topLeft.y);

      // Margin so they do not overlap
      let margin = 1;
    
      // Draw the zone border
      push();
        noFill();
        // Color change depending on zone state
        // If we are in entering password state:
        if (z.isActive) {
          // Zone is being tapped → green if correct, red if incorrect
          if (z.number === randomCode[userTapSequence.length - 1]) {
            // Correct tap
            stroke(0, 200, 0);
            fill(0, 200, 0, 100);
          } else {
            // Incorrect tap
            stroke(200, 0, 0);
            fill(200, 0, 0, 100);
          }
        } else if (!isEnteringCode && isInside(currentLatitude, currentLongitude, z)) {
          // When are not in entering password state:
          // Player is inside this zone → blue
          stroke(0, 0, 255);
          fill(0, 0, 255, 50);
        } else {
          // Default zone appearance → gray/transparent
          stroke(0);
          fill(0, 25);
        }
        strokeWeight(2);
        rect(left + margin, top + margin, w - margin * 2, h - margin * 2);
      pop();
    
      // Drawing zone number if it is inside zone
      if (!isEnteringCode && isInside(currentLatitude, currentLongitude, z)) {
        push();
          fill(255,100);
          circle(left + w / 2, top + h / 2, 35);
          fill(0);
          noStroke();
          textSize(25);
          textAlign(CENTER, CENTER);
          text(z.number, left + w / 2, top + h / 2);
        pop();
      }    
    }
    
    // only update and draw our point if we actually have data
    me.update();
    me.display();

    // Draw all other players
    for(let user in otherPlayers){
      otherPlayers[user].update();
      otherPlayers[user].display();
    }
  }

  // Display the random code at top center
  // if there is a random code:
  if (randomCode) {
    push();
      textSize(16);
      textAlign(LEFT, TOP);
      let paddingX = 15;
      let paddingY = 10;

      // Calculate total width of code text to draw rectangle
      let codeText = randomCode.join(", ");
      let displayStr = "YOUR CODE: " + codeText;
      let txtWidth = textWidth(displayStr) + paddingX * 2;
      let txtHeight = textSize() * 1.4 + paddingY * 2;

      // Draw rectangle
      fill(255, 220);
      noStroke();
      rectMode(CENTER);
      rect(width / 2, txtHeight / 2 + 5, txtWidth, txtHeight, 8);

      // Draw the text numbers individually
      // given we change their color during checking code
      let startX = width / 2 - txtWidth / 2 + paddingX;
      let yPos = 5 + paddingY;

      // Draw the text
      fill(0);
      text("YOUR CODE: ", startX, yPos);
      startX += textWidth("YOUR CODE: ");

      // Draw each number
      for (let i = 0; i < randomCode.length; i++) {
        // based on number correct color change
        if (i < userTapSequence.length) {
          fill(0, 200, 0); 
        } else {
          fill(0);
        }
        // number text
        text(randomCode[i], startX, yPos);

        // adjust position for next number
        startX += textWidth(randomCode[i]);

        // adding a ", " in btw them as long as it is not the last number
        if (i < randomCode.length - 1) {
          // drawa the ", "
          text(", ", startX, yPos);

          // adjust postion for next number given the addition of comma
          startX += textWidth(", ");
        }
      }

      // feedback text
      let feedbackY = txtHeight + 20;

      // Showcase feedback as long as time of feedback remains
      if (codeFeedback && millis() - codeFeedbackTime < FEEDBACK_DURATION) {
        push();
          textAlign(CENTER, CENTER);
          textSize(16);

          // Calculate rectangle size
          let feedbackPaddingX = 10;
          let feedbackPaddingY = 6;
          let feedbackWidth = textWidth(codeFeedback) + feedbackPaddingX * 2;
          let feedbackHeight = textAscent() + textDescent() + feedbackPaddingY * 2;

          // Draw white rectangle behind feedback
          rectMode(CENTER);
          fill(255, 220);
          noStroke();
          rect(width / 2, feedbackY + feedbackHeight / 2, feedbackWidth, feedbackHeight, 6);

          // Draw feedback text centered
          fill(codeFeedbackColor);
          text(codeFeedback, width / 2, feedbackY + feedbackHeight / 2);
        pop();
      } else {
        // make it blank when no feedback is given
        codeFeedback = "";
      }
    pop();
  }

  if(gameEnded){
    push();
      // background
      fill(0, 180);
      rectMode(CORNER);
      rect(0, 0, width, height);
  
      // whether you win or lose
      textAlign(CENTER, CENTER);
      fill(255);
      textSize(48);
      text(endGameMessage, width / 2, height / 2 - 40);
  
      // the winner
      textSize(24);
      text('Winner: ' + winnerName, width / 2, height / 2 + 10);
      text('Code: ' + winnerCode.join(", "), width / 2, height / 2 + 40);
    pop();
  }

  // Display bottom-right notification
if (notificationText && millis() - notificationStartTime < NOTIFICATION_DURATION) {
  push();
    textSize(10);
    textAlign(RIGHT, CENTER);

    let paddingX = 15;
    let paddingY = 10;
    let txtWidth = textWidth(notificationText) + paddingX * 2;
    let txtHeight = textAscent() + textDescent() + paddingY * 2;

    // Position bottom-right
    let x = width - 20;
    let y = height - 40;

    // Smooth fade-out
    let alpha = map(millis() - notificationStartTime, 0, NOTIFICATION_DURATION, 255, 0);
    fill(255, 255, 255, alpha * 0.9);
    noStroke();
    rectMode(CENTER);
    rect(x - txtWidth / 2, y, txtWidth, txtHeight, 8);

    // Text
    fill(0, alpha);
    text(notificationText, x - paddingX, y + 2);
  pop();
}

}

/*----------------------------------------------*/
// P5 touch events: (https://p5js.org/reference/#Touch)
function touchStarted() {
  if(mapInit){
    // show position it is tapped
    let pos = myMap.pixelToLatLng(touches[0].x, touches[0].y);
    // console.log("TOUCHED", pos);

    // only begin touching squares/zones when entering code button is pressed
    if (isEnteringCode){
      for (let z of zones) {
        // Check what zone it is tapping
        if (isInside(pos.lat, pos.lng, z)) {
          console.log("Tapped zone number:", z.number);

          z.isActive = true;

          // Check if the tapped number is correct in sequence
          if (z.number === randomCode[userTapSequence.length]) {
            userTapSequence.push(z.number);
            // if it is send message
            console.log("Correct! Sequence so far:", userTapSequence);

            // Set feedback for correct tap (green)
            codeFeedback = "Correct!";
            codeFeedbackColor = color(0, 200, 0);
            codeFeedbackTime = millis();            

            // Check if full code is completed
            if (userTapSequence.length === randomCode.length) {
              // if it all code has been completed send to server accomplishment
              console.log("Code completed! Submitting to server:", userTapSequence);
              socket.emit('submitCode', { username: myName, code: userTapSequence });

              // Set feedback for correct tap (green)
              codeFeedback = "CODE COMPLETE! YOU WIN";
              codeFeedbackColor = color(0, 200, 0);
              codeFeedbackTime = millis();    

              // Reset everything
              userTapSequence = [];
              isEnteringCode = false;

              // Remove the bright style of Button "activated"
              submitCodeButton.classList.remove('active');
            }
          } else {
            // reset everything
            console.log("Wrong tap! Resetting sequence.");
            userTapSequence = [];
            isEnteringCode = false;

            // Set feedback for incorrect (red)
            codeFeedback = "Incorrect – try again!";
            codeFeedbackColor = color(200, 0, 0);
            codeFeedbackTime = millis();

            // Remove the bright style of Button "activated"
            submitCodeButton.classList.remove('active');
          }

          // stop when a condition has been met
          break;
        }
      }
    }
  } else {
    // if no GPS and touched screen:
    console.log("TOUCHED", touches);
  }
}

function touchMoved() {
}

function touchEnded() {
  for (let z of zones) {
    z.isActive = false;
  }
}

/*----------------------------------------------*/
// GPS Maping

// Adjusting window size to match map
function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

// Calls for GPS whenever location changes
function handleNewPosition(pos){
  // fix location for chinese map tiles
  let lonlat = fixForChineseMap(pos);
  currentLongitude = lonlat[0];
  currentLatitude = lonlat[1];
  // console.log(currentLatitude, currentLongitude);

  // sending the location to the server to send to other users
  let locForServer = {
    lat: currentLatitude, 
    lon: currentLongitude,
    username: myName
  }
  socket.emit('locationFromClient', locForServer);

  // if map already displayed, update the point
  if(mapInit){
    updateMapContent();
  }
}

// Generate random code
function generateRandomCode() {
  let code = [];
  for (let i = 0; i < codeSize; i++) {
    // random from 0 to 15
    // make sure is integer so destimate random number from 0-16
    code.push(Math.floor(Math.random() * 16));
  }
  return code;
}

function showNotification(text) {
  notificationText = text;
  notificationStartTime = millis();
  console.log("NOTIFICATION:", text);
}

/*----------------------------------------------*/
// Sockets

// Listening for the location of other users
socket.on('locationFromServer', function(data){
  // if list has this existing player
  if(otherPlayers[data.user]){
    // Update this existing player location
    otherPlayers[data.user].lat = data.lat;
    otherPlayers[data.user].lon = data.lon;
  } else {
    // given it is a New player (not from its list), create object
    otherPlayers[data.user] = new PlayerPoint(data.lat, data.lon, data.user);
  }
  // console.log('data from someone', data);
})

socket.on('updateReadyCount', function(data) {
  showNotification(data.readyUsers + '/' + data.totalUsers + ' players ready');
});

// Listening for the user that left
socket.on('userThatLeft', function(username) {
  showNotification(username + " left the game");

  // Reset game state 
  gameStarted = false;
  gameEnded = false;
  isEnteringCode = false;
  currentZone = null;
  randomCode = null;
  discoveredCode = [];
  userTapSequence = []; 
  zones = [];
  zoneNumbers = [];

  // Reset feedback and visuals
  codeFeedback = "";
  codeFeedbackColor = color(0);
  codeFeedbackTime = 0;

  // reset UI elements
  readyButton.style.display = 'block';
  submitCodeButton.style.display = 'none'; 
  submitCodeButton.classList.remove('active');  

  // remove from your otherPlayers
  delete otherPlayers[username];

  // report
  console.log("Game fully reset — waiting for players to ready up again.");
});

// Listening for when to start the game
socket.on('startGame', function(data) {
  showNotification("Game started!");

  // Draw the Grid
  createSquare(data.centerLat, data.centerLon, data.numbers);

  // Generate the random 8-number code (0-15)
  randomCode = [];
  for (let i = 0; i < codeSize; i++) {
    randomCode.push(Math.floor(Math.random() * 16));
  }

  // Show submit button at bottom center
  submitCodeButton.style.display = 'block';

  // Report start game whether code is being generated and received correct data
  console.log("Received center and numbers:", data.centerLat, data.centerLon, data.numbers);
  console.log("Generated code:", randomCode);
});

// Listening for when to game is over
socket.on('endGame', function(data){
  // Store data
  winnerName = data.username;
  winnerCode = data.code;

  // Determine win/loss message for this client
  if(data.username === myName){
    endGameMessage = "YOU WIN!";
  } else {
    endGameMessage = "YOU LOSE";
  }

  // Stop entering code
  isEnteringCode = false;
  submitCodeButton.classList.remove('active');

  // Hide the submit code button
  submitCodeButton.style.display = 'none'; 

  // Show ready button to start a new game
  readyButton.style.display = 'block';

  // Clear the grid
  zones = [];

  // Stop further game logic
  gameEnded = true;

  console.log("Game ended for client:", myName, "Winner:", winnerName);
})

/*----------------------------------------------*/
// Buttons and Infos

// Entering Username:
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');

// Ways to submit:
// clicking on screen button to submit
nameSubmit.addEventListener('click', function() {
    sendName()
});

// pressing the "enter" key to submit
nameSubmit.addEventListener('keyup', function(e){ 
    if (e.key === 'Enter') {
        sendName(); 
    }
});

// When name is submited it does:
function sendName() {
  // Clear what was inputed in textbox
  const name = nameInput.value.trim();

  // IGNORE this submission given nothing was entered in box
  if (!name) return;

  // SAVE name into global variable
  myName = name; 

  // Erase the naming display
  nameOverlay.style.display = 'none';

  // request GPS
  requestGPS();

  // Update name into point
  me = new PlayerPoint(currentLatitude, currentLongitude, myName, true);
}

// Ready Game Button
const readyButton = document.getElementById('readyButton');

// when button of ready for game is pressed
readyButton.addEventListener('click', function() {
  // Reset game end flags
  gameEnded = false;
  endGameMessage = "";
  winnerName = "";
  winnerCode = [];

  // Send ready event to server
  socket.emit('ready', { username: myName });

  // Hide button after clicked
  readyButton.style.display = 'none';
});

// Ready to try Code
const submitCodeButton = document.getElementById('submitCodeButton');

// when button of being ready to try code
submitCodeButton.addEventListener('click', function() {
   // Activate entering code sequence
  isEnteringCode = true;

  // empty try sequence
  userTapSequence = [];

  // change button aesthetic to activated mode
  submitCodeButton.classList.add('active');

  // report entering entering sequence mode
  console.log("Tap sequence activated! Tap zones in order.");
});


/*----------------------------------------------*/
// Convert GPS coordinates to on-screen position
function updateMapContent(){
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude, currentLongitude)
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;

  // Update ALL other players
  for (let user in otherPlayers) {
    let pos = myMap.latLngToPixel(otherPlayers[user].lat, otherPlayers[user].lon);
    otherPlayers[user].goalX = pos.x;
    otherPlayers[user].goalY = pos.y;
  }
}

// Drawing Grid based on data
function createSquare(centerLat, centerLon, numbers) {
  // clear old zones
  zones = [];

  // Save numbers
  zoneNumbers = numbers;

  // Draw grid based on row and collums
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      // calculation: the center of the current zone is found by
      // center + zone size * (what order of right/left - 0.5 for center of rect)
      // same for bottom/top
      let lat = centerLat + zoneSize * (gridRows/2 - r - 0.5);
      let lon = centerLon + zoneSize * (c - gridCols/2 + 0.5);

      // convert the grid into linear
      let numberIndex = r * gridCols + c;

      // store hidden number to each zone
      zones.push({
        lat,
        lon,
        number: zoneNumbers[numberIndex],
        isActive: false
      });
    }
  }
}

// determine whehter it is inside the zone or not
function isInside(lat, lon, zone) {
  // the max and min of x and y based on zone
  let halfSize = zoneSize / 2;
  let squareNorth = zone.lat + halfSize;
  let squareSouth = zone.lat - halfSize;
  let squareEast = zone.lon + halfSize;
  let squareWest = zone.lon - halfSize;

  // if it fits inside zone return that it is true els no
  if (lat < squareNorth && lat > squareSouth && lon < squareEast && lon > squareWest) {
    return true;
  } else {
    return false;
  }
}

/*----------------------------------------------*/
// Drawing Player Point Location
class PlayerPoint {
  constructor(lat, lon, username, isMe = false) {
    this.lat = lat;
    this.lon = lon;
    this.username = username;
    this.isMe = isMe;
    this.x = 0;
    this.y = 0;
    this.goalX = 0;
    this.goalY = 0;
    this.size = 14;

    // Colors differ by type
    if (this.isMe) {
      // more of a greenish color for my own location point
      this.col = color(170, 240, 190);            // circle color for me
      this.strokeCol = "pink";                    // circle outline for me
      this.boxCol = color(210, 255, 220, 230);    // name box for me
      this.textCol = color(40, 100, 60);          // name text for me
    } else {
      // more of a alarming red color for other players point
      this.col = color(240, 170, 170);            // circle color for others
      this.strokeCol = "red";                     // circle outline for others
      this.boxCol = color(255, 220, 220, 230);    // name box for others
      this.textCol = color(120, 20, 20);          // name text for others
    }
  }

  update() {
    this.x = lerp(this.x, this.goalX, 0.2);
    this.y = lerp(this.y, this.goalY, 0.2);
  }

  display() {
    push();
      translate(this.x, this.y);

      // Pulsing circle
      fill(this.col);
      stroke(this.strokeCol);
      strokeWeight(3);
      let dia = this.size + sin(frameCount * 0.1);
      circle(0, 0, dia);

      // Username bubble
      if (this.username) {
        noStroke();
        textSize(14);
        textAlign(CENTER, CENTER);
        let paddingX = 8;
        let paddingY = 4;
        let txtWidth = textWidth(this.username) + paddingX * 2;
        let txtHeight = textAscent() + textDescent() + paddingY * 2;
        let rectY = -this.size - txtHeight / 2 - 10;

        // name bubble
        fill(this.boxCol);
        rectMode(CENTER);
        rect(0, rectY, txtWidth, txtHeight, 8);
        // name
        fill(this.textCol);
        text(this.username, 0, rectY + 1);
      }
    pop();
  }
}