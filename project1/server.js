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
✅ SCORING / TIMING SYSTEM TO MATCH GOAL SHAPE
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

    // CREATE SHAPE
    for (let i = 0; i < count; i++) {
        shapeVertexes.push({ 
            x: Math.random() * minW, 
            y: Math.random() * minH 
        });
    }

    // SEND SHAPE TO ALL USERS
    io.emit('shape', shapeVertexes);

    // CHECK IF MATCH
    checkConstellation();
}

function checkConstellation() {
    const users = Object.values(userPos);
    const userArr = users;  

    // CHECK IF USERS ARE ARRANGED IN THE CORRECT ORDER
    // (any consecutive sequence of users with positions
    // that match the sequence of shape vertexes)
    let orderedOk = false;
    const count = shapeVertexes.length;

    // SLIDE A WINDOW OF *count* CONSECUTIVE USERS
    // (e.g. if count = 4 and userArray = [u1, u2, u3, u4]
    // check [u1,u2,u3,u4], [u2,u3,u4,u5], etc.)
    for (let start = 0; start <= userArr.length - count; start++) {
        // COPY CURRENT GROUP
        const block = userArr.slice(start, start + count);

        // GENERATE ALL CYCIC RATIONS OF "shapeVertexes"
        for (let shift = 0; shift < count; shift++) {
            // CREATES 1 ROATION
            const rotated = [];
            for (let j = 0; j < count; j++) {
                // SHIFT 1 TO THE RIGHT, BUT ADAPT TO COUNT
                // (e.g. 0,1,2,3 -> 1,2,3,4 -> 1,2,3,0)
                rotated.push(shapeVertexes[(j + shift) % count]);
            }

            // CHECK IF IT MATCHES USER POSITION
            // DISTANCE FORMULA
            const match = rotated.every((v, j) =>
                Math.hypot(v.x - block[j].x, v.y - block[j].y) <= HIT_DIST
            );

            // IF MATCH, TRUE AND BREAK OUT OF LOOP
            if (match) {
                orderedOk = true;
                break;
            }
        }
        // IF THERES IS A MATCH BREAK OUT 
        if (orderedOk) break;
    }

    // IF ALL CONDITIONS IS MET
    if (orderedOk) {
        // INFORM ALL USERS OF THIS SUCCESS
        io.emit('shapeSuccess'); 

        rebuildShape(Object.keys(userPos).length);
        // console.log('success');
    } else {
        // console.log('no success');
    }
    
}

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});