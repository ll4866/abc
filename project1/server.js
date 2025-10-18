const express = require('express');
const https = require("https");
const fs = require("fs");

const app = express(); 
const portHTTPS = 4230;

// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));

// Creating object of key and certificate
const options = {
    key: fs.readFileSync("keys-for-local-https/localhost-key.pem"),
    cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

const HTTPSserver = https.createServer(options, app);

const { Server } =  require('socket.io'); // include library
const { IncomingMessage } = require('http');
const io = new Server(HTTPSserver);

let shapeVertexes       = [];
let tilts               = {};
let userNames           = {};
let userPos             = {};
let vertexState         = [];
let lastCount           = 0;
let minW                = Infinity;
let minH                = Infinity;  
const maxTilt           = 30;
const boost             = 3;
const noBoost           = 1;
const HIT_DIST          = 30;

/* USER TESTING: 
✅ REMOVING TRANSLATION (DISTRACTING) maybe as a next LEVEL
✅ LOOS LIKE CONSTELLATION COULD CONNECT AND FURTHER (SET PATTERN)
- SCORING / TIMING SYSTEM TO MATCH GOAL SHAPE
✅ NAMING TO KNOW WHO IS WHO
- INSTRUCTIONS ON SCREEN TO KNOW WHAT TO DO
✅ MESSAGE FIXES (ENABLE)
*/

io.on('connection', function(socket){
    console.log('a user connected', socket.id);

    // LISTENING FOR THE NAME CLIENT HAS GIVEN
    // STORE AND SEND TO ALL
    socket.on('setName', (name) => {
        // PREVENT UNDEFINED, EMPTY, ETC
        if (!name || !name.trim()) return;

        // SAVE NAMES INTO LIST
        userNames[socket.id] = name;

        // SENDING TO ALL CLIENTS LIST OF NAMES
        io.emit('userList', userNames);
        // console.log('User named:', name);
    });

    // LISTENING FOR NUMBER OF DEVICES
    // IF NUMBER CHANGED, MAKE A NEW SHAPE
    // SEND TO ALL CLIENTS NEW SHAPE
    socket.on('count', function(data) {
        // IF COUNT DOES NOT MATCH
        if (data.c !== lastCount) {
            // IF CANVAS DOES NOT MATCH
            if (data.w < minW || data.h < minH) {
                // RECORDING SMALLEST CANVAS
                minW = data.w;
                minH = data.h;
                // console.log('size', minW, minH);

                rebuildShape(data.c);
            }

            rebuildShape(data.c);
            // console.log(data.c);
        }
    });

    // LISTENING FOR POSITION FROM OTHERS
    // SENDING TO ALL CLIENTS THIS INFO
    socket.on('move', function(posData){
        // STORE THE POSITON OF USERS
        userPos[posData.id] = { x: posData.x, y: posData.y }

        // SEND TO ALL THIS NEW POSITION
        io.emit('update', posData);
        // console.log('Locator:', position);

        // CHECKING IF USER VERTEX MATCHES SHAPE VERTEX
        checkConstellation(); 
    });

    // LISTENING FOR CHAT FROM OTHERS CLIENTs
    // SENDING TO ALL CLIENTS THIS INFO
    socket.on('chat', function(msg){
        // console.log('Message:', msg);
        io.emit('allChat', msg);
    });

    // LISTENING FOR TILT FROM OTHER CLIENTS
    // SENDING TO ALL THIS INFO
    socket.on('tilt', function(t) {
        // console.log(t);

        // SAVING CLIENTS TILTS
        const id = t.id || socket.id;
        const old = tilts[id]; 
        
        // SEARCH FOR CURRENT DATA MATCH OLD STORED DATA
        // IF SO UPDATE
        if (!old || old.gamma !== t.g || old.beta !== t.b) {
            tilts[id] = { gamma: t.g, beta: t.b };
        }

        // REQUIRE > 1 TILT
        const entries = Object.values(tilts);
        if (entries.length >= 2) {

            // SEARCH AND STORE NUMBER OF CLIENTS GOING OVER |maxTilt|
            const crossed = [];
            for (const e of entries) {
                if (Math.abs(e.gamma) > maxTilt || Math.abs(e.beta) > maxTilt){ 
                    crossed.push(e);
                }
            }

            // IF MORE THAN 2 CLIENTS MET THE CONDITION
            if (crossed.length >= 2) {
                // console.log('[2-TILT-CROSSED]', tilts);
                
                // COUNT HOW MANY CLIENTS GOT TO WHAT DIRECTION
                const counters = {
                    gammaPos: 0, gammaNeg: 0,
                    betaPos:  0, betaNeg:  0
                };
                for (const t of crossed) {
                    if (t.gamma > maxTilt){
                        counters.gammaPos++;
                    } else if (t.gamma < -maxTilt) {
                        counters.gammaNeg++;
                    } else if (t.beta > maxTilt) {
                        counters.betaPos++;
                    } else if (t.beta < -maxTilt) {
                        counters.betaNeg++;
                    }
                }

                // IF ANY COUNT IS ABOVE 2, BOOST SPEED
                const ok = Object.values(counters).some(c => c >= 2);
                if (ok) {
                    io.emit('allTilt', boost);
                    // console.log('condition met')
                } else {
                    io.emit('allTilt', noBoost);
                    // console.log('condition not met');    
                }                      
            } else {
                io.emit('allTilt', noBoost);
            }
        } else {
            io.emit('allTilt', noBoost);
        }

        // SENDING TILT TO ALL USERS
        io.emit('otherTilt', {
            id: t.id,
            b:  t.b,
            g:  t.g
        });
        // console.log('otherTilt', {id: t.id, b:  t.b, g:  t.g});
    });

    // LISTENING FOR A LEAVING CLIENT
    // SENDING TO ALL CLIENTS THIS INFO
    // ERASE THAT CLIENT FROM DATA
    socket.on('disconnect', function() {
        console.log('someone disconnected', socket.id);
        // SENDING TO ALL USERS THE CLIENT THAT LEFT
        io.emit('left', socket.id);

        // REMOVE DATA OF THE CLIENT THAT LEFT
        delete tilts[socket.id];
        delete userNames[socket.id];
        delete userPos[socket.id];

        // UPDATE SHAPE
        rebuildShape(Object.keys(userPos).length);
    });
});

function rebuildShape(count) {
    // STORE NEW COUNT
    lastCount = count;

    // RESET
    shapeVertexes.length = 0;
    vertexState.length = 0;

    // CREATE SHAPE
    for (let i = 0; i < count; i++) {
        shapeVertexes.push({ 
            x: Math.random() * minW, 
            y: Math.random() * minH 
        });
        vertexState.push(false);
    }

    // SEND SHAPE TO ALL USERS
    io.emit('shape', shapeVertexes);
    checkConstellation();
}

function checkConstellation() {
    const users = Object.values(userPos);
    const userArr = users;  

    // RESET
    vertexState.fill(false);
  
    // CHECK IF A USER SUCCESFULLY 
    // APPROACHES A VERTEX (any user, any vertex)
    for (let i = 0; i < shapeVertexes.length; i++) {
      const v = shapeVertexes[i];
      for (const u of users) {
        // TRIANGLE HYPOTENUSE DISTANCE IS BELOW EXPECTED
        if (Math.hypot(v.x - u.x, v.y - u.y) <= HIT_DIST) {
            // THAT VERTEX IS TRUE
            vertexState[i] = true;

            // PREVENT FROM TESTING THE SAME VERTEX
            break;
            // console.log(vertexState);
        }
      }
    }

    // CHECK IF ALL VERTEX MEET CONDITION
    if (vertexState.includes(false)) return;
    // console.log('all vertex matches');

    // CHECK IF ORDER IS CORRECT
    // (any consecutive block of count users)
    let orderedOk = false;
    const count = shapeVertexes.length;
    // TRY EVERY POSSIBLE COMBINATION
    for (let start = 0; start <= userArr.length - count; start++) {
        // FOR EVERY VERTEX CHECK
        const match = shapeVertexes.every((v, i) => {
            // CONSECUTIVE USER
            const u = userArr[start + i];
            // IF THE PATTERN MATCH
            return Math.hypot(v.x - u.x, v.y - u.y) <= HIT_DIST;
        });

        // IF IT MATCHES SAY IT IS TURE
        if (match) { 
            orderedOk = true; 
            break; 
        }
    }

    // IF ALL CONDITIONS IS MET
    if (vertexState.every(Boolean) && orderedOk) {
        console.log('success');
    }
}

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});