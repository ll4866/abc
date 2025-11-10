// Map Setup
let mappa = new Mappa('Leaflet');
let myMap;
let canvas;
let currentLongitude = 0;
let currentLatitude = 0;
let mapInit = false;
let me;
let otherPlayers = {};

if (location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')) {
   socket = io({ path: "/lucas/port-4230/socket.io" });
} else {
   socket = io();
}

let mappa_options = {
   lat: 0,
   lng: 0,
   zoom: 16,
   style: 'https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}',
}

/*----------------------------------------------*/
// Game Setup
let myName = '';
let myTeam = null;
let codeSize = 8;

// Team colors
const teamColors = {
   red: { main: '#ff4444', light: '#ffcccc', dark: '#cc0000' },
   blue: { main: '#4444ff', light: '#ccccff', dark: '#0000cc' },
   orange: { main: '#ff8800', light: '#ffddaa', dark: '#cc6600' }
};

// CODE SETUP
let randomCode;
let isEnteringCode = false;
let userTapSequence = [];
let codeFeedback = "";
let codeFeedbackColor;
let codeFeedbackTime = 0;
const FEEDBACK_DURATION = 3000;
let numberOfTries = 0;
let cooldownTime = 0;
const COOLDOWN_DURATION = 10000;

// Notifications
let notificationText = "";
let notificationStartTime = 0;
const NOTIFICATION_DURATION = 10000;

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
let winnerTeam = "";

function setup() {
   canvas = createCanvas(windowWidth, windowHeight);
   canvas.parent("p5-canvas-container");
   me = new PlayerPoint(currentLatitude, currentLongitude, myName, true);
   codeFeedbackColor = color(0);
}

function draw() {
   clear();

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

   if (mapInit) {
       // Draw zones
       for (let z of zones) {
           let topLeft = myMap.latLngToPixel(z.lat + zoneSize / 2, z.lon - zoneSize / 2);
           let bottomRight = myMap.latLngToPixel(z.lat - zoneSize / 2, z.lon + zoneSize / 2);
          
           let top = min(topLeft.y, bottomRight.y);
           let left = min(topLeft.x, bottomRight.x);
           let w = abs(bottomRight.x - topLeft.x);
           let h = abs(bottomRight.y - topLeft.y);
           let margin = 1;
          
           push();
           noFill();
           if (z.isActive) {
               if (z.number === randomCode[userTapSequence.length - 1]) {
                   stroke(0, 200, 0);
                   fill(0, 200, 0, 100);
               } else {
                   stroke(200, 0, 0);
                   fill(200, 0, 0, 100);
               }
           } else if (!isEnteringCode && isInside(currentLatitude, currentLongitude, z)) {
               stroke(0, 0, 255);
               fill(0, 0, 255, 50);
           } else {
               stroke(0);
               fill(0, 25);
           }
           strokeWeight(2);
           rect(left + margin, top + margin, w - margin * 2, h - margin * 2);
           pop();
          
           if (!isEnteringCode && isInside(currentLatitude, currentLongitude, z)) {
               push();
               fill(255, 100);
               circle(left + w / 2, top + h / 2, 35);
               fill(0);
               noStroke();
               textSize(25);
               textAlign(CENTER, CENTER);
               text(z.number, left + w / 2, top + h / 2);
               pop();
           }
       }
      
       me.update();
       me.display();

       for (let user in otherPlayers) {
           otherPlayers[user].update();
           otherPlayers[user].display();
       }
   }

   // Display team badge in top-left
   if (myTeam) {
       push();
       let badgeX = 20;
       let badgeY = 20;
       let badgeSize = 60;
      
       fill(teamColors[myTeam].light);
       noStroke();
       rect(badgeX, badgeY, badgeSize, 40, 8);
      
       fill(teamColors[myTeam].dark);
       textAlign(CENTER, CENTER);
       textSize(12);
       text("TEAM", badgeX + badgeSize / 2, badgeY + 12);
       textSize(16);
       text(myTeam.toUpperCase(), badgeX + badgeSize / 2, badgeY + 28);
       pop();
   }

   // Display code
   if (randomCode) {
       push();
       textSize(16);
       textAlign(LEFT, TOP);
       let paddingX = 15;
       let paddingY = 10;

       let codeText = randomCode.join(", ");
       let displayStr = "YOUR CODE: " + codeText;
       let txtWidth = textWidth(displayStr) + paddingX * 2;
       let txtHeight = textSize() * 1.4 + paddingY * 2;

       fill(255, 220);
       noStroke();
       rectMode(CENTER);
       rect(width / 2, txtHeight / 2 + 5, txtWidth, txtHeight, 8);

       let startX = width / 2 - txtWidth / 2 + paddingX;
       let yPos = 5 + paddingY;

       fill(0);
       text("YOUR CODE: ", startX, yPos);
       startX += textWidth("YOUR CODE: ");

       for (let i = 0; i < randomCode.length; i++) {
           if (i < userTapSequence.length) {
               fill(0, 200, 0);
           } else {
               fill(0);
           }
           text(randomCode[i], startX, yPos);
           startX += textWidth(randomCode[i]);

           if (i < randomCode.length - 1) {
               text(", ", startX, yPos);
               startX += textWidth(", ");
           }
       }

       let feedbackY = txtHeight + 20;

       if (codeFeedback && millis() - codeFeedbackTime < FEEDBACK_DURATION) {
           push();
           textAlign(CENTER, CENTER);
           textSize(16);

           let feedbackPaddingX = 10;
           let feedbackPaddingY = 6;
           let feedbackWidth = textWidth(codeFeedback) + feedbackPaddingX * 2;
           let feedbackHeight = textAscent() + textDescent() + feedbackPaddingY * 2;

           rectMode(CENTER);
           fill(255, 220);
           noStroke();
           rect(width / 2, feedbackY + feedbackHeight / 2, feedbackWidth, feedbackHeight, 6);

           fill(codeFeedbackColor);
           text(codeFeedback, width / 2, feedbackY + feedbackHeight / 2);
           pop();
       } else {
           codeFeedback = "";
       }
       pop();
   }

   if (gameEnded) {
       push();
       fill(0, 180);
       rectMode(CORNER);
       rect(0, 0, width, height);
      
       textAlign(CENTER, CENTER);
       fill(255);
       textSize(48);
       text(endGameMessage, width / 2, height / 2 - 40);
      
       textSize(24);
       text('Winner: ' + winnerName, width / 2, height / 2 + 10);
       text('Team: ' + winnerTeam, width / 2, height / 2 + 40);
       pop();
   }

   // Notifications
   if (notificationText && millis() - notificationStartTime < NOTIFICATION_DURATION) {
       push();
       textSize(10);
       textAlign(RIGHT, CENTER);

       let paddingX = 15;
       let paddingY = 10;
       let txtWidth = textWidth(notificationText) + paddingX * 2;
       let txtHeight = textAscent() + textDescent() + paddingY * 2;

       let x = width / 2 + txtWidth / 2;
       let y = height / 4 - 40;

       let alpha = map(millis() - notificationStartTime, 0, NOTIFICATION_DURATION, 255, 0);
       fill(255, 255, 255, alpha * 0.9);
       noStroke();
       rectMode(CENTER);
       rect(x - txtWidth / 2, y, txtWidth, txtHeight, 8);

       fill(0, alpha);
       text(notificationText, x - paddingX, y + 2);
       pop();
   }
}

/*----------------------------------------------*/
// Touch Events
function touchStarted() {
   if (mapInit) {
       let pos = myMap.pixelToLatLng(touches[0].x, touches[0].y);

       if (isEnteringCode) {
           for (let z of zones) {
               if (isInside(pos.lat, pos.lng, z)) {
                   console.log("Tapped zone number:", z.number);

                   z.isActive = true;

                   if (z.number === randomCode[userTapSequence.length]) {
                       userTapSequence.push(z.number);
                       console.log("Correct! Sequence so far:", userTapSequence);

                       codeFeedback = "Correct!";
                       codeFeedbackColor = color(0, 200, 0);
                       codeFeedbackTime = millis();

                       if (userTapSequence.length === randomCode.length) {
                           console.log("Code completed! Submitting to server:", userTapSequence);
                           socket.emit('submitCode', { username: myName, code: userTapSequence });

                           codeFeedback = "CODE COMPLETE! YOU WIN";
                           codeFeedbackColor = color(0, 200, 0);
                           codeFeedbackTime = millis();

                           userTapSequence = [];
                           isEnteringCode = false;
                           submitCodeButton.classList.remove('active');
                       }
                   } else {
                       console.log("Wrong tap! Resetting sequence.");
                       userTapSequence = [];
                       isEnteringCode = false;

                       submitCodeButton.classList.remove('active');

                       // Count incorrect attempt
                       numberOfTries++;
                       console.log('Attempt try:', numberOfTries);

                       // Check if reached 3 failed tries
                       if (numberOfTries >= 3) {
                           // start cooldown time
                           cooldownTime = millis();

                           // showcase the cooldown time as feedback
                           codeFeedback = "Too many tries! Wait 10 seconds...";
                           codeFeedbackColor = color(255, 140, 0);
                           codeFeedbackTime = millis();
                       } else {
                           // Set feedback for incorrect (red)
                           codeFeedback = "Incorrect – try again!";
                           codeFeedbackColor = color(200, 0, 0);
                           codeFeedbackTime = millis();
                       }
                   }
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
   for (let z of zones) {
       z.isActive = false;
   }
}

/*----------------------------------------------*/
// GPS Mapping
function windowResized() {
   resizeCanvas(windowWidth, windowHeight);
}

function handleNewPosition(pos) {
   let lonlat = fixForChineseMap(pos);
   currentLongitude = lonlat[0];
   currentLatitude = lonlat[1];

   let locForServer = {
       lat: currentLatitude,
       lon: currentLongitude,
       username: myName
   }
   socket.emit('locationFromClient', locForServer);

   if (mapInit) {
       updateMapContent();
   }
}

function showNotification(text) {
   notificationText = text;
   notificationStartTime = millis();
   console.log("NOTIFICATION:", text);
}

/*----------------------------------------------*/
// Socket Events

socket.on('locationFromServer', function(data) {
   if (otherPlayers[data.user]) {
       otherPlayers[data.user].lat = data.lat;
       otherPlayers[data.user].lon = data.lon;
   } else {
       otherPlayers[data.user] = new PlayerPoint(data.lat, data.lon, data.user, false, data.team);
   }
});

socket.on('updateReadyCount', function(data) {
   showNotification(data.readyUsers + '/' + data.totalUsers + ' players ready');
});

socket.on('userThatLeft', function(data) {
   showNotification(data.username + " left the game");
   delete otherPlayers[data.username];
   console.log(data.username + " disconnected but game continues");
});

socket.on('startGame', function(data) {
   showNotification("Game started!");

   // Reset cooldown variables when game starts
   numberOfTries = 0;
   cooldownTime = 0;

   createSquare(data.centerLat, data.centerLon, data.numbers);

   randomCode = data.randomCode;

   submitCodeButton.style.display = 'block';

   console.log("Received center and numbers:", data.centerLat, data.centerLon, data.numbers);
   console.log("Generated code:", randomCode);
});

socket.on('updateState', function(data){
  showNotification(data + 'is attempting the code');
 })

socket.on('endGame', function(data) {
   winnerName = data.username;
   winnerTeam = data.team;

   if (data.username === myName) {
       endGameMessage = "YOU WIN!";
   } else {
       endGameMessage = "YOU LOSE";
   }

   isEnteringCode = false;
   submitCodeButton.classList.remove('active');
   submitCodeButton.style.display = 'none';
   readyButton.style.display = 'block';

   zones = [];
   gameEnded = true;

   console.log("Game ended for client");
});

socket.on('teamSelected', function(data) {
   myTeam = data.team;
   console.log("Joined team:", myTeam);
   console.log("Team data:", data.teamData);
});

socket.on('updateTeams', function(teams) {
   console.log("Teams updated:", teams);
});

/*----------------------------------------------*/
// UI Elements

const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');
const teamOverlay = document.getElementById('teamOverlay');

nameSubmit.addEventListener('click', function() {
   sendName();
});

nameInput.addEventListener('keyup', function(e) {
   if (e.key === 'Enter') {
       sendName();
   }
});

function sendName() {
   const name = nameInput.value.trim();
   if (!name) return;

   myName = name;
   nameOverlay.style.display = 'none';
  
   // Show team selection
   teamOverlay.style.display = 'flex';
}

// Team selection buttons
document.querySelectorAll('.team-button').forEach(button => {
   button.addEventListener('click', function() {
       const team = this.dataset.team;
       myTeam = team;
      
       teamOverlay.style.display = 'none';
       requestGPS();
       me = new PlayerPoint(currentLatitude, currentLongitude, myName, true, myTeam);
       socket.emit('selectTeam', { username: myName, team: team });
   });
});

const readyButton = document.getElementById('readyButton');
readyButton.addEventListener('click', function() {
   gameEnded = false;
   endGameMessage = "";
   winnerName = "";
   winnerCode = [];

   socket.emit('ready', { username: myName });
   readyButton.style.display = 'none';
});

const submitCodeButton = document.getElementById('submitCodeButton');
submitCodeButton.addEventListener('click', function() {
   // tell everyone this players has started submitting their code
 socket.emit('state', myName);

   // Check if player is still in cooldown
   if (millis() - cooldownTime < COOLDOWN_DURATION && numberOfTries >= 3) {
       // Calculate time remaining until next attempt
       let remaining = ceil((COOLDOWN_DURATION - (millis() - cooldownTime)) / 1000);
       
       // Display time until next attempt
       codeFeedback = "Wait " + remaining + "s before trying again.";
       codeFeedbackColor = color(255, 140, 0);
       codeFeedbackTime = millis();
       console.log("In cooldown, wait", remaining, "seconds");
       return; // Don't activate code entry
   }

   // Reset tries if cooldown has passed
   if (millis() - cooldownTime >= COOLDOWN_DURATION && numberOfTries >= 3) {
       numberOfTries = 0;
       codeFeedback = "Cooldown is over, you may try again.";
       codeFeedbackColor = color(140, 255, 0);
       codeFeedbackTime = millis();
       console.log("Cooldown ended, tries reset");
   }

   // Activate entering code sequence
   isEnteringCode = true;
   userTapSequence = [];
   submitCodeButton.classList.add('active');
   console.log("Tap sequence activated! Tap zones in order.");
});

/*----------------------------------------------*/
// Map Functions
function updateMapContent() {
   let myPosOnCanvas = myMap.latLngToPixel(currentLatitude, currentLongitude)
   me.goalX = myPosOnCanvas.x;
   me.goalY = myPosOnCanvas.y;

   for (let user in otherPlayers) {
       let pos = myMap.latLngToPixel(otherPlayers[user].lat, otherPlayers[user].lon);
       otherPlayers[user].goalX = pos.x;
       otherPlayers[user].goalY = pos.y;
   }
}

function createSquare(centerLat, centerLon, numbers) {
   zones = [];
   zoneNumbers = numbers;

   for (let r = 0; r < gridRows; r++) {
       for (let c = 0; c < gridCols; c++) {
           let lat = centerLat + zoneSize * (gridRows / 2 - r - 0.5);
           let lon = centerLon + zoneSize * (c - gridCols / 2 + 0.5);
           let numberIndex = r * gridCols + c;

           zones.push({
               lat,
               lon,
               number: zoneNumbers[numberIndex],
               isActive: false
           });
       }
   }
}

function isInside(lat, lon, zone) {
   let halfSize = zoneSize / 2;
   let squareNorth = zone.lat + halfSize;
   let squareSouth = zone.lat - halfSize;
   let squareEast = zone.lon + halfSize;
   let squareWest = zone.lon - halfSize;

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
       this.lat = lat;
       this.lon = lon;
       this.username = username;
       this.isMe = isMe;
       this.team = team;
       this.x = 0;
       this.y = 0;
       this.goalX = 0;
       this.goalY = 0;
       this.size = 14;

       if (this.isMe) {
           if (this.team && teamColors[this.team]) {
               this.col = color(teamColors[this.team].main);
               this.strokeCol = teamColors[this.team].dark;
               this.boxCol = color(teamColors[this.team].light + 'E6');
               this.textCol = color(teamColors[this.team].dark);
           } else {
               this.col = color(170, 240, 190);
               this.strokeCol = "pink";
               this.boxCol = color(210, 255, 220, 230);
               this.textCol = color(40, 100, 60);
           }
       } else {
           if (this.team && teamColors[this.team]) {
               this.col = color(teamColors[this.team].main);
               this.strokeCol = teamColors[this.team].dark;
               this.boxCol = color(teamColors[this.team].light + 'E6');
               this.textCol = color(teamColors[this.team].dark);
           } else {
               this.col = color(240, 170, 170);
               this.strokeCol = "red";
               this.boxCol = color(255, 220, 220, 230);
               this.textCol = color(120, 20, 20);
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

       fill(this.col);
       stroke(this.strokeCol);
       strokeWeight(3);
       let dia = this.size + sin(frameCount * 0.1);
       circle(0, 0, dia);

       if (this.username) {
           noStroke();
           textSize(14);
           textAlign(CENTER, CENTER);
           let paddingX = 8;
           let paddingY = 4;
           let txtWidth = textWidth(this.username) + paddingX * 2;
           let txtHeight = textAscent() + textDescent() + paddingY * 2;
           let rectY = -this.size - txtHeight / 2 - 10;

           fill(this.boxCol);
           rectMode(CENTER);
           rect(0, rectY, txtWidth, txtHeight, 8);
          
           fill(this.textCol);
           text(this.username, 0, rectY + 1);
       }
       pop();
   }
}