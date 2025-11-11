// Map Setup
let mappa = new Mappa('Leaflet');
let myMap;
let canvas;
let currentLongitude = 0;
let currentLatitude  = 0;
let mapInit          = false;
let me;
let otherPlayers     = {};

// link
if (location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')) {
  socket = io({ path: "/lucas/port-4230/socket.io" });
} else {
  socket = io();
}

// Type of Map
let mappa_options = {
  lat:    0,
  lng:    0,
  zoom:   16,
  style: 'https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}',
}

/*----------------------------------------------*/
// GAME SETUP
let myName    = '';
let myTeam    = null;
let codeSize  = 8;

// team colors
const teamColors = {
  red:    { main: '#ff4444', light: '#ffcccc', dark: '#cc0000' },
  blue:   { main: '#4444ff', light: '#ccccff', dark: '#0000cc' },
  orange: { main: '#ff8800', light: '#ffddaa', dark: '#cc6600' }
};

// zones/squares
let zones       = [];
let zoneNumbers = [];
let gridRows    = 4;
let gridCols    = 4;
let zoneSize    = 0.0016;

// game state notification
let notificationText        = "";
let notificationStartTime   = 0;
const NOTIFICATION_DURATION = 10000;

// CODE SETUP
let randomCode;
let isEnteringCode  = false;
let userTapSequence = [];

// feedback for code progress
let codeFeedback        = "";
let codeFeedbackColor;
let codeFeedbackTime    = 0;
const FEEDBACK_DURATION = 3000;

// attempt cooldown
let numberOfTries       = 0;
let cooldownTime        = 0;
const COOLDOWN_DURATION = 30000;

// Endgame
let gameEnded       = false;
let endGameMessage  = "";
let winnerName      = "";
let winnerTeam      = "";

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
  if (!mapInit && GPS_GRANTED && currentLongitude != 0) {
    console.log("starting map");
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;

    // Show ready button only if team is selected
    if (myTeam) {
      readyButton.style.display = 'block';
    }
  }

  // When Map is intialized, draw users on map
  if (mapInit) {
    // Draw zones/squares
    for (let z of zones) {
      let topLeft     = myMap.latLngToPixel(z.lat + zoneSize / 2, z.lon - zoneSize / 2);
      let bottomRight = myMap.latLngToPixel(z.lat - zoneSize / 2, z.lon + zoneSize / 2);
      
      // Calculating the x, y, w, h for rectangle
      let top   = min(topLeft.y, bottomRight.y);
      let left  = min(topLeft.x, bottomRight.x);
      let w     = abs(bottomRight.x - topLeft.x);
      let h     = abs(bottomRight.y - topLeft.y);
      
      // Margin so squares do not overlap
      let margin = 1;
      
      // Draw the zone border
      push();
        noFill();
        strokeWeight(2);
        
        // Color change depending on zone state
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
          // When players is  not in entering password:
          // & if player is inside zone → blue
          stroke(0, 0, 255);
          fill(0, 0, 255, 50);
        } else {
          // Default zone appearance → gray/transparent
          stroke(0);
          fill(0, 25);
        }

        // ZONES/SQUARES
        rect(left + margin, top + margin, w - margin * 2, h - margin * 2);
      pop();
      
      // Drawing zone number if it is inside zone
      if (!isEnteringCode && isInside(currentLatitude, currentLongitude, z)) {
        push();
          translate(left + w / 2, top + h / 2);
          // circle
          fill(255, 100);
          circle(0, 0, 35);
          
          // text
          fill(0);
          noStroke();
          textSize(25);
          textAlign(CENTER, CENTER);
          text(z.number, 0, 0);
        pop();
      }
    }
    
    // only update and draw our point if we actually have data
    me.update();
    me.display();
    
    // Draw all other players
    for (let user in otherPlayers) {
      otherPlayers[user].update();
      otherPlayers[user].display();
    }

    // Display team badge in top-left
    if (myTeam) {
      let badgeSize = 80;
      
      // Display text
      push();
        translate(width - badgeSize - 20, 20);

        // rectangle
        fill(teamColors[myTeam].light);
        noStroke();
        rect(0, 0, badgeSize, 40, 14);
          
        // text
        fill(teamColors[myTeam].dark);
        textAlign(CENTER, CENTER);
        textSize(15);
        text("TEAM", badgeSize / 2, 12);
        textSize(18);
        text(myTeam.toUpperCase(), badgeSize / 2, 28);
      pop();
    }

    // Display code
    // if there is a random code:
    if (randomCode) {
      push();
        textSize(15);
        textAlign(LEFT, TOP);
        let paddingX = 15;
        let paddingY = 10;

        // Calculate total width of code text to draw rectangle
        let codeText    = randomCode.join(", ");
        let displayStr  = "YOUR CODE: " + codeText;
        let txtWidth    = textWidth(displayStr) + paddingX * 2;
        let txtHeight   = textSize() * 1.4 + paddingY * 2;
        translate(0,70);

        // Draw rectangle
        fill(255, 220);
        noStroke();
        rectMode(CENTER);
        rect(width / 2, 20, txtWidth, txtHeight, 8);

        // Draw the text numbers individually
        // given we change their color during checking code
        let startX = width / 2 - txtWidth / 2 + paddingX;
        let yPos = 5 + paddingY;

        // Draw the common text
        fill(0);
        text("YOUR CODE: ", startX, yPos);
        startX += textWidth("YOUR CODE: ");

        // Draw each #
        for (let i = 0; i < randomCode.length; i++) {
          // based on # correct color change
          if (i < userTapSequence.length) {
            fill(0, 200, 0);
          } else {
            fill(0);
          }

          // # text
          text(randomCode[i], startX, yPos);

          // adjust position for next #
          startX += textWidth(randomCode[i]);

          // adding a ", " in btw them as long as it is not the last #
          if (i < randomCode.length - 1) {
            // draw the ", "
            text(", ", startX, yPos);

            // adjust postion for next # given the addition of comma
            startX += textWidth(", ");
          }
        }

        // Individual Feedback
        // Showcase feedback as long as time of feedback remains
        if (codeFeedback && millis() - codeFeedbackTime < FEEDBACK_DURATION) {
          push();
            textAlign(CENTER, CENTER);
            textSize(15);

            // Calculate rectangle size
            let feedbackY         = txtHeight + 25;
            let feedbackPaddingX  = 10;
            let feedbackPaddingY  = 6;
            let feedbackWidth     = textWidth(codeFeedback) + feedbackPaddingX * 2;
            let feedbackHeight    = textAscent() + textDescent() + feedbackPaddingY * 2;

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
          // make indiviual feedback blank when no feedback is given
          codeFeedback = "";
        }
      pop();
    }

    // ENDGAME screen
    if (gameEnded) {
      push();
        // background
        fill(0, 180);
        rectMode(CORNER);
        rect(0, 0, width, height);
        
        // showcase whether you win or lose
        textAlign(CENTER, CENTER);
        fill(255);
        textSize(48);
        text(endGameMessage, width / 2, height / 2 - 40);
        
        // the winner of this round
        textSize(24);
        text('🏆 Winning Player: ' + winnerName, width / 2, height / 2 + 10);
        text('🏆 Winning Team: ' + winnerTeam, width / 2, height / 2 + 40);
      pop();
    }

    // Display game state notification same for ALL
    if (notificationText && millis() - notificationStartTime < NOTIFICATION_DURATION) {
      push();
        textSize(15);
        textAlign(RIGHT, CENTER);

        // variables
        let paddingX  = 15;
        let paddingY  = 10;
        let txtWidth  = textWidth(notificationText) + paddingX * 2;
        let txtHeight = textAscent() + textDescent() + paddingY * 2;

        // Position
        let x = width / 2 + txtWidth / 2;
        let y = height / 4;

        // Smooth fade-out
        let alpha = map(millis() - notificationStartTime, 0, NOTIFICATION_DURATION, 255, 0);
        
        // background
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
}

/*----------------------------------------------*/
// Touch Events
function touchStarted() {
  if (mapInit) {
    // show position it is tapped
    let pos = myMap.pixelToLatLng(touches[0].x, touches[0].y);
    // console.log("TOUCHED", pos);

    // when entering code button state
    // begin touching squares/zones 
    if (isEnteringCode) {
      for (let z of zones) {
        // Check what zone it is tapping
        if (isInside(pos.lat, pos.lng, z)) {
          console.log("Tapped zone number:", z.number);

          z.isActive = true;

          // Check if the tapped number is correct in sequence
          if (z.number === randomCode[userTapSequence.length]) {
            userTapSequence.push(z.number);
            console.log("Correct! Sequence so far:", userTapSequence);

            // Set feedback for correct tap (green)
            codeFeedback = "Correct!";
            codeFeedbackColor = color(0, 200, 0);
            codeFeedbackTime = millis();

            // Check if full code is completed
            if (userTapSequence.length === randomCode.length) {
              // if code has been completed send to server
              console.log("Code completed! Submitting to server:", userTapSequence);
              socket.emit('submitCode', { username: myName, team: myTeam });

              // Set feedback for correct tap (green)
              codeFeedback = "CODE COMPLETE! YOU WIN";
              codeFeedbackColor = color(0, 200, 0);
              codeFeedbackTime = millis();

              // Reset sequence counting
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

            // Remove the bright style of Button "activated"
            submitCodeButton.classList.remove('active');

            // Count incorrect attempt
            numberOfTries++;
            console.log('Attempt try:', numberOfTries);

            // Check if reached 3 failed tries
            if (numberOfTries > 3) {
              // start cooldown time
              cooldownTime = millis();

              // showcase the cooldown time as feedback
              codeFeedback = "Too many tries! Wait 10 seconds...";
              codeFeedbackColor = color(200, 0, 0);
              codeFeedbackTime = millis();
            } else {
              // Set feedback for incorrect (red)
              codeFeedback = "Incorrect – try again!";
              codeFeedbackColor = color(200, 0, 0);
              codeFeedbackTime = millis();
            }
          }
        // stop when a condition has been met
        break;
        }
      }
    }
  } else {
    console.log("TOUCHED", touches);
  }
}

function touchMoved() {}

function touchEnded() {
  // when not touching screen set all zone's inactive
  for (let z of zones) {
    z.isActive = false;
  }
}

/*----------------------------------------------*/
// GPS Mapping

// Adjusting window size to match map
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Calls for GPS whenever location changes
function handleNewPosition(pos) {
  // if(pos.coords.accuracy > 20){
  //   console.log("not so accurate, skipping", pos.coords.accuracy);
  //   return;
  // }
  // console.log("accuracy", pos.coords.accuracy);

  // fix location for chinese map tiles
  let lonlat = fixForChineseMap(pos);
  currentLongitude = lonlat[0];
  currentLatitude = lonlat[1];

  // sending the location to the server to send to other users
  socket.emit('locationFromClient', {
    lat: currentLatitude,
    lon: currentLongitude,
    username: myName
  });

  // if map already displayed, update the point
  if (mapInit) {
    updateMapContent();
  }
}

// Make all notification timer
function showNotification(text) {
  notificationText = text;
  notificationStartTime = millis();
  console.log("NOTIFICATION:", text);
}

/*----------------------------------------------*/
// Socket Events

// Listening for the location of other users
socket.on('locationFromServer', function(data) {
  // if list has this existing player
  if (otherPlayers[data.user]) {
    // Update this existing player location
    otherPlayers[data.user].lat = data.lat;
    otherPlayers[data.user].lon = data.lon;
  } else {
    // given it is a New player (not from its list), create object
    otherPlayers[data.user] = new PlayerPoint(data.lat, data.lon, data.user, false, data.team);
  }
});

// Listening for how many users are ready
socket.on('updateReadyCount', function(data) {
  showNotification('Teams ready:' + data + '/' + '3');
});

// Listening for the user that left
socket.on('userThatLeft', function(data) {
  showNotification(data.username + " left the game");
  delete otherPlayers[data.username];
  console.log(data.username + " disconnected but game continues");
});

// Listening for when to start the game
socket.on('startGame', function(data) {
  showNotification("Game started!");

  // Reset cooldown variables when game starts
  numberOfTries = 0;
  cooldownTime  = 0;

  // Draw the Grid
  createSquare(data.centerLat, data.centerLon, data.numbers);

  // Save the randomCode given
  randomCode = data.randomCode;

  // Show submit button at bottom center
  submitCodeButton.style.display = 'block';

  // Report start game
  console.log("Received center and numbers:", data.centerLat, data.centerLon, data.numbers);
  console.log("Generated code:", randomCode);
});

// who is attempting the code
socket.on('updateState', function(data){
  showNotification(data + ' is attempting the code');
})

// Listening for when to game is over
socket.on('endGame', function(data) {
  // Store data
  winnerName = data.username;
  winnerTeam = data.team;

  // Determine win/loss message for this client
  if (data.team === myTeam) {
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

  console.log("Game ended for client");
});

// Listening for my own team assignment and data
socket.on('teamSelected', function(data) {
  myTeam = data.team;
  console.log("Joined team:", myTeam);
  console.log("Team data:", data.teamData);
});

// Listening for when missing a player for a team
socket.on('updateTeams', function(emptyTeams) {
  // Stop entering code
  isEnteringCode = false;
  submitCodeButton.classList.remove('active');

  // Hide the submit code button
  submitCodeButton.style.display = 'none';

  // Show ready button to start a new game
  readyButton.style.display = 'block';

  // Clear the grid
  zones = [];

  // Show notification for each empty team
  emptyTeams.forEach(team => {
    showNotification("Someone left and team " + team.toUpperCase() + " has no members!");
    console.log("Team " + team + " has no members!");
  });
});

/*----------------------------------------------*/
// UI Elements

// Entering Username:
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');

// Ways to submit:
// clicking on screen button to submit
nameSubmit.addEventListener('click', function() {
  sendName();
});

// pressing the "enter" key to submit
nameInput.addEventListener('keyup', function(e) {
  if (e.key === 'Enter') {
    sendName();
  }
});

// When name is submitted it does:
function sendName() {
  // Clear what was inputed in textbox
  const name = nameInput.value.trim();

  // IGNORE this submission given nothing was entered in box
  if (!name) return;

  // SAVE name into global variable
  myName = name;

  // Erase the naming display
  nameOverlay.style.display = 'none';
  
  // Show team selection
  teamOverlay.style.display = 'flex';
}

// Team selection buttons
const teamOverlay = document.getElementById('teamOverlay');

document.querySelectorAll('.team-button').forEach(button => {
  button.addEventListener('click', function() {
    // save decision
    const team = this.dataset.team;
    myTeam = team;

    // Hide team button
    teamOverlay.style.display = 'none';

    // request GPS
    requestGPS();

    // Update my user point 
    me = new PlayerPoint(currentLatitude, currentLongitude, myName, true, myTeam);
    
    // send to server what team selected
    socket.emit('selectTeam', { username: myName, team: team });
  });
});

// Ready Game Button
const readyButton = document.getElementById('readyButton');

// when button of ready for game is pressed
readyButton.addEventListener('click', function() {
  // Reset game end flags
  gameEnded       = false;
  endGameMessage  = "";
  winnerName      = "";
  winnerCode      = [];

  // Send ready event to server
  socket.emit('ready', { username: myName });

  // Hide button after clicked
  readyButton.style.display = 'none';
});

// Ready to try Code
const submitCodeButton = document.getElementById('submitCodeButton');

// when button of being ready to try code
submitCodeButton.addEventListener('click', function() {
  // tell everyone this players has started submitting their code
  socket.emit('state', myName);

  // Check if player is still in cooldown
  if (millis() - cooldownTime < COOLDOWN_DURATION && numberOfTries > 3) {
    // Calculate time remaining until next attempt
    let remaining = ceil((COOLDOWN_DURATION - (millis() - cooldownTime)) / 1000);
  
    // Display time until next attempt
    codeFeedback      = "Wait " + remaining + "s before trying again.";
    codeFeedbackColor = color(200, 0, 0);
    codeFeedbackTime  = millis();
    console.log("In cooldown, wait", remaining, "seconds");

    // Don't activate code entry
    return; 
  }

  // Reset tries if cooldown has passed
  if (millis() - cooldownTime >= COOLDOWN_DURATION && numberOfTries > 3) {
    // reset count
    numberOfTries = 0;

    // showcase that cooldown is over
    codeFeedback      = "Cooldown is over, you may try again.";
    codeFeedbackColor = color(0);
    codeFeedbackTime  = millis();
    console.log("Cooldown ended, tries reset");
  }

  // Activate entering code sequence
  isEnteringCode = true;
  userTapSequence = [];

  // Change color of button
  submitCodeButton.classList.add('active');

  // Report
  console.log("Tap sequence activated! Tap zones in order.");
});

/*----------------------------------------------*/
// Map Functions

// Convert GPS coordinates to on-screen position
function updateMapContent() {
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

  // Save hidden numbers
  zoneNumbers = numbers;

  // Draw grid based on row and colums
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      // calculation:
      let lat = centerLat + zoneSize * (gridRows / 2 - r - 0.5);
      let lon = centerLon + zoneSize * (c - gridCols / 2 + 0.5);
      
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


// determine whether it is inside the zone or not
function isInside(lat, lon, zone) {
  // the max and min of x and y based on zone
  let halfSize    = zoneSize / 2;
  let squareNorth = zone.lat + halfSize;
  let squareSouth = zone.lat - halfSize;
  let squareEast  = zone.lon + halfSize;
  let squareWest  = zone.lon - halfSize;

  // if it fits inside zone return that it is true else false
  if (lat < squareNorth && lat > squareSouth && lon < squareEast && lon > squareWest) {
    return true;
  } else {
    return false;
  }
}

/*----------------------------------------------*/
// Player Point Class
class PlayerPoint {
  constructor(lat, lon, username, isMe = false, team = null) {
    this.lat      = lat;
    this.lon      = lon;
    this.username = username;
    this.isMe     = isMe;
    this.team     = team;
    this.x        = 0;
    this.y        = 0;
    this.goalX    = 0;
    this.goalY    = 0;
    this.size     = 14;

    // Colors differ by group
    if (this.isMe) {
      if (this.team && teamColors[this.team]) {
        this.col        = color(teamColors[this.team].main);
        this.strokeCol  = teamColors[this.team].dark;
        this.boxCol     = color(teamColors[this.team].light + 'E6');
        this.textCol    = color(teamColors[this.team].dark);
      }
    } else {
      if (this.team && teamColors[this.team]) {
        this.col        = color(teamColors[this.team].main);
        this.strokeCol  = teamColors[this.team].dark;
        this.boxCol     = color(teamColors[this.team].light + 'E6');
        this.textCol    = color(teamColors[this.team].dark);
      }
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
        let paddingX  = 8;
        let paddingY  = 4;
        let txtWidth  = textWidth(this.username) + paddingX * 2;
        let txtHeight = textAscent() + textDescent() + paddingY * 2;
        let rectY     = -this.size - txtHeight / 2 - 10;

        // name bubble
        fill(this.boxCol);
        rectMode(CENTER);
        rect(0, rectY, txtWidth, txtHeight, 8);
          
        fill(this.textCol);
        text(this.username, 0, rectY + 1);
      }
    pop();
  }
}