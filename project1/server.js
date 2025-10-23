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

// STORED VALUES
let connectedUSERS       = [];
let shapeVertexes        = [];
let tilts                = {};
let userNames            = {};
let userPos              = {};
let lastCount            = 0;
let minW                 = Infinity;
let minH                 = Infinity;  
let vertexMatchOrder     = [];
let claimedVertices      = [];
let rankingData          = {};
let lastHighestScore     = 0;

// ADJUST VARIABLES
const maxTilt            = 30;
const HIT_DIST           = 30;
const boost              = 3;
const noBoost            = 1;
const endGAMETIME        = 10;
let gameEND              = false;

// TIMER FOR SHAPE
let SHAPE_TIME_LIMIT     = 15;
let shapeTimer           = null;
let shapeEndTime         = 0;

// CONDITION
let allNamed             = false; 

// CONSTELLATION MYTH
/* reference: tracery in p5.js 
from Machine Learning for Artist & Designers F24 
professor Gottfried Haider (gohai at nyu edu)
*/
const tracery            = require('./tracery.js');
let shapeSolvedThisRound = false; 
let breakTime            = 10;
const mythGrammar = tracery.createGrammar({
    name: ['Arin','Lyra','Cassiel','Tauren','Vega','Orion','Selune','Mira','Draven','Caelum'],
    object: ['wolf','phoenix','serpent','lyre','mirror','spear','crown','swan','twin','lion'],
    mood: ['silent','flickering','eternal','restless','forgotten','radiant','wandering','ancient'],
    adjacent: ['Pisces','Taurus','Orion','Aquila','Cygnus','Perseus','Draco','Pegasus','Leo'],
    theme: [
      'hope and loss','journeys across time','forgotten kings','the first dawn',
      'endless love','vanished empires','shattered dreams','unspoken destinies'
    ],
  
    origin: [
      '#intro# #description# #legend#'
    ],
  
    intro: [
      'Shaped like a #mood# #object#, this constellation lies between #adjacent# and #adjacent#.',
      'It forms the outline of a #mood# #object#, its pattern gleaming softly in the night.',
      'High above, the stars arrange themselves into the likeness of a #mood# #object#, known to sailors and dreamers alike.'
    ],
  
    description: [
      'Observers say its stars trace the motion of #name#, who once roamed the heavens in search of #theme#.',
      'The ancients believed its form told of #theme#, and would whisper prayers to it under moonlight.',
      'On clear nights, its shape seems to shift, as if the #object# itself stirs among the stars.',
      'To those who watch long enough, the constellation appears alive — a story drawn in fire across the sky.'
    ],
  
    legend: [
      'Legends claim that #name# carved its shape into the heavens to preserve their memory for all eternity.',
      'Some say that when the constellation fades, the spirit of the #object# descends to walk the earth once more.',
      'Poets tell that its light carries the last breath of #name#, echoing through the cosmos as a song of #theme#.',
      'Travelers who followed its outline believed it would guide them toward their destined path beneath the stars.'
    ]
  });
  

mythGrammar.addModifiers(tracery.baseEngModifiers);
let mythTimer = null;

io.on('connection', function(socket){
    console.log('a user connected', socket.id);

    // TRACKING CONNECTED SOCKET CLIENTS
    if (!connectedUSERS.includes(socket.id)) {
        connectedUSERS.push(socket.id);
        // console.log('Connected users:', connectedUSERS);
    }

    // LISTEN FOR HIGHEST SCORE FOR NOW
    socket.on('highScore', function(score){
        // IF HIGHEST SCORE WAS BEATEN
        if (score > lastHighestScore){
            // UPDATE NEW HIGHEST
            lastHighestScore = score;

            // SENDING TO ALL USERS THIS NEWS
            io.emit('highestScore', score);
        }
    })

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

        // ALL SOCKET CONNECTED
        const allNamed = connectedUSERS.every(id =>
            userNames[id] && userNames[id] !== id && userNames[id] !== 'undefined'
        );

        // BEGINING OF THE GAME
        // START ONCE EVERY PLAYER HAS BEEN NAMED
        if (allNamed && !shapeTimer) {
            startShapeTimer();
            // console.log('ALL DEVICES NAMED ✅');
        } else {
            // console.log('MISSING SOME DEVICES ❌');
        }
    });

    // LISTENING FOR NUMBER OF DEVICES
    // IF NUMBER CHANGED, MAKE A NEW SHAPE
    // SEND TO ALL CLIENTS NEW SHAPE
    socket.on('count', function(data) {
        // IF COUNT DOES NOT MATCH
        if (data.c !== lastCount) {
            // STORE NEW COUNT
            lastCount = data.c;

            // IF CANVAS DOES NOT MATCH
            if (data.w < minW || data.h < minH) {
                // RECORDING SMALLEST CANVAS
                minW = data.w;
                minH = data.h;
                
                // RESHAPE
                rebuildShape(data.c);
                startShapeTimer();

                // console.log('size', minW, minH);
            }

            // RESHAPE
            rebuildShape(data.c);
            startShapeTimer();
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
        
        // CHECKING IF USER VERTEX MATCHES SHAPE VERTEX
        checkConstellation();    
        
        // console.log('Locator:', position);
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

    // LISTENS IF ANY CLIENT REACHED GOAL
    socket.on('goalMET', function(){
        // RESET SCORES
        allScores = {}; 

        // ASK EVERY CLIENT FOR SCORE
        io.emit('requestSCORES');
        // console.log('requestSCORES');
    })

    // LISTENS FOR INDIVIDUAL SCORES
    socket.on('individualScores', function(data){
        rankingData[data.id] = data.score;

        // ONLY WHEN ALL IS COLLECTED SEND TO ALL
        if (Object.keys(rankingData).length === lastCount){
            io.emit('AllSCORES', rankingData);
            // console.log('Final scores:', allScores);

            // REMIND ALL USERS TO FREEZE GAME
            io.emit('freezeGame', endGAMETIME * 1000);
            // console.log('freezeGame');

            // RESET AFTERWARDS 
            setTimeout(resetServer, endGAMETIME * 1000);
        }
    })

    // LISTENING FOR A LEAVING CLIENT
    // SENDING TO ALL CLIENTS THIS INFO
    // ERASE THAT CLIENT FROM DATA
    socket.on('disconnect', function() {
        console.log('someone disconnected', socket.id);
        // SENDING TO ALL USERS THE CLIENT THAT LEFT
        io.emit('left', socket.id);

        // REMOVE DATA OF THE CLIENT THAT LEFT
        connectedUSERS = connectedUSERS.filter(id => id !== socket.id);
        delete tilts[socket.id];
        delete userNames[socket.id];
        delete userPos[socket.id];
        delete rankingData[socket.id];

        // RESET CLAIMED VERTICES FOR CLIENT THAT LEFT
        for (let i = 0; i < claimedVertices.length; i++) {
            if (claimedVertices[i] === socket.id) {
                claimedVertices[i] = null;
            }
        }
        
        // REMOVE THE DICONNECTED CLIENT FROM MATCH ORDER
        let newVertexMatchOrder = [];
        for (let i = 0; i < vertexMatchOrder.length; i++) {
            if (vertexMatchOrder[i] !== socket.id) {
                newVertexMatchOrder.push(vertexMatchOrder[i]);
            }
        }
        vertexMatchOrder = newVertexMatchOrder;

        // UPDATE SHAPE
        if (connectedUSERS.length > 0) {
            rebuildShape(lastCount);
            startShapeTimer();
        }
    });

});

function resetServer() {
    // CLEAR GAME STATE
    allScores        = {};
    rankingData      = {};
    vertexMatchOrder = [];
    claimedVertices  = [];

    // CLEAR DATA OF CLIENTS
    tilts    = {};
    userPos  = {};

    // RESET SCORING
    lastHighestScore = 0;

    // RESET TESTER
    shapeSolvedThisRound = false; 

    // NEW SHAPE
    rebuildShape(lastCount);
    startShapeTimer();
    // console.log('resetGame');
}

function rebuildShape(count) {
    // CHECK ROUND BOOLAN
    shapeSolvedThisRound = false;

    // RESET
    shapeVertexes.length = 0;

    // RESET MATCH TRACKING 
    vertexMatchOrder = [];
    claimedVertices = [];
    for (let i = 0; i < count; i++) {
        claimedVertices.push(null);
        vertexMatchOrder.sort((idA, idB) => idA.localeCompare(idB));
    }

    // DEFINE PLAYABLE AREA BASED ON CLIENT CONSTRAINTS
    const minX = 25;
    const maxX = minW - 25;
    const minY = 80;
    const maxY = minH - 80;

    // CREATE SHAPE
    for (let i = 0; i < count; i++) {
        const x = Math.random() * (maxX - minX) + minX;
        const y = Math.random() * (maxY - minY) + minY;
        shapeVertexes.push({ x, y });
    }

    // SEND SHAPE TO ALL USERS
    io.emit('shape', shapeVertexes);

    // CHECK IF MATCH
    checkConstellation();
}

function checkConstellation() {
    const users = Object.entries(userPos)
        .map(([id, pos]) => ({ id, ...pos }))
        .sort((a, b) => a.id.localeCompare(b.id))   
    const userArr = users.sort((a, b) => a.id.localeCompare(b.id));

    // 1. MATCH USERS TO VETICES THEY CATCH
    // TRACK WHICH USERS HAVE CLAIMED WHICH VERTICES
    vertexMatchOrder = vertexMatchOrder || [];
    claimedVertices = claimedVertices || new Array(shapeVertexes.length).fill(null);

    // LOOP THROUGH EACH ACTIVE USER AND THEIR POSITION
    for (const [id, pos] of Object.entries(userPos)) {

        // CHECK IF USER HAS ALREADY CLAIMED ANY VERTEX
        for (let i = 0; i < shapeVertexes.length; i++) {
            if (claimedVertices[i] === id) {
                const v = shapeVertexes[i];
                const d = Math.hypot(v.x - pos.x, v.y - pos.y);
                if (d > HIT_DIST) {
                    // User moved away, unclaim vertex
                    claimedVertices[i] = null;
                    vertexMatchOrder = vertexMatchOrder.filter(u => u !== id);
                    console.log('Vertex ' + i + ' unclaimed by ' + id + ' (moved away)');
                }
            }
        }

        // ELSE, CHECK IF THIS USER MATCHES ANY UNCLAIMED VERTEX
        for (let i = 0; i < shapeVertexes.length; i++) {
            // ONLY CHECK VERTICES THAT HAVEN’T BEEN CLAIMED YET
            if (!claimedVertices[i]) {

                // IF USER’S POSITION IS WITHIN THE HIT DISTANCE OF A VERTEX
                const v = shapeVertexes[i];                
                if (Math.hypot(v.x - pos.x, v.y - pos.y) <= HIT_DIST) {
                    
                    // ADD THIS USER TO THE CLAIM ORDER LIST
                    vertexMatchOrder.push(id);
                    
                    // MARK THIS VERTEX AS CLAIMED BY THE USER
                    claimedVertices[i] = id;
                    
                    console.log('Vertex ' + i + ' claimed by ' + id);
                    break;
                }
            }
        }
    }

    // 2. CHECKING ORDER
    const vertexCount = shapeVertexes.length;
    const allClaimed = vertexMatchOrder.length === vertexCount;

    // CHECK IF ALL VERTICES HAVE BEEN CLAIMED AND MORE THAN 1 PLAYER TO PROCEED
    if (lastCount <= 1 || !allClaimed) return;
    console.log('all claimed', lastCount);
    
    // IF THERE IS LESS THAN 3 PLAYERS ORDER IS OK, ELSE CHECK ORDER
    // CHECK IF USERS ARE ARRANGED IN THE CORRECT ORDER
        // (any consecutive sequence of users with positions
        // that match the sequence of shape vertexes)
    let orderedOk = false;
    if (lastCount < 4) {
        orderedOk = true;
        // console.log('3 or fewer players – order auto-OK', lastCount);
    } else {
        // SLIDE A WINDOW
        // (e.g. if count = 4 and userArray = [u1, u2, u3, u4]
        // check [u1,u2,u3,u4], [u2,u3,u4,u5], etc.)
        for (let start = 0; start <= lastCount - vertexCount; start++) {
            // COPY CURRENT GROUP
            const block = userArr.slice(start, start + vertexCount);
            console.log(`Checking block starting at index ${start}:`, block);

            // TRY BOTH CLOCKWISE AND COUNTERCLOCKWISE VERSIONS
            const vertexOrders = [
                shapeVertexes,
                [...shapeVertexes].reverse()
            ];

            for (const orderVariant of vertexOrders) {
                console.log('Checking order variant:', orderVariant.map(v => ({x:v.x, y:v.y})));

                // GENERATE ALL CYCIC RATIONS OF "shapeVertexes"
                for (let shift = 0; shift < vertexCount; shift++) {
                    
                    // CREATES 1 ROATION
                    const rotated = [];
                    for (let j = 0; j < vertexCount; j++) {
                        // SHIFT 1 TO THE RIGHT, BUT ADAPT TO COUNT
                        // (e.g. 0,1,2,3 -> 1,2,3,4 -> 1,2,3,0)
                        rotated.push(orderVariant[(j + shift) % vertexCount]);
                    }
                    // console.log(`  Shift: rotated vertices:`, rotated.map(v => ({x:v.x, y:v.y})));

                    const match = rotated.every((v, idx) => {
                        const d = Math.hypot(v.x - block[idx].x, v.y - block[idx].y);
                        console.log(`    Comparing vertex ${idx}: distance ${d}`);
                        return d <= HIT_DIST;
                    });

                    // IF MATCH, TRUE AND BREAK OUT OF LOOP
                    if (match) {
                        console.log('order match');
                        orderedOk = true;
                        break;
                    }
                }
                // IF THERES IS A MATCH BREAK OUT 
                if (orderedOk) {
                    console.log('next');
                    break;
                }
            }
            if (orderedOk) break;
        }
        console.log('4+ players – running order check', lastCount);
    }
    console.log('proceed')
    
    // 3. SEND SUCCESS
    // IF ALL CONDITIONS IS MET
    if (orderedOk && !shapeSolvedThisRound) {
        // MARK ROUND DONE
        shapeSolvedThisRound = true;

        // BUILD CONSTELLATION MYTH
        const myth = generateMyth();

        // SEND ORDER OF MATCH TO ALL
        clearTimeout(shapeTimer);
        io.emit('shapeSuccess', {
            order: vertexMatchOrder,
            count: lastCount,
            myth: myth,
            time: breakTime
        });

        // UNTIL TIME IS OUT DOES IT MAKE NEW SHAPE        
        mythTimer = setTimeout(() => {
            // NEW SHAPE
            rebuildShape(lastCount);
            startShapeTimer();
            // console.log('reset');
        }, breakTime * 1000);
        
        console.log('success', {
            // order: vertexMatchOrder,
            // count: lastCount,
            // myth: myth,
            // time: breakTime
        } );
    } else {
        if (lastCount < 4) {
            console.log(lastCount);
        }
        console.log('no success', orderedOk, shapeSolvedThisRound);
    }
}

// FUNCTION TO GENERATE MYTH
function generateMyth() {
    // RANDOM NUMBER
    const num = Math.floor(Math.random() * 500) + 1;

    // OTHER PARTS OF TRACERY
    const intro = mythGrammar.flatten('#intro#');
    const description = mythGrammar.flatten('#description#');

    // COMBINE INTO FINAL MYTH
    const myth = `Constellation ${num}: ${intro} ${description}`;
    return myth;
}

function startShapeTimer() {
    // CLEAR PREVIOUS TIME
    if (shapeTimer) clearTimeout(shapeTimer);

    // TIME FOR EACH SHAPE BASED ON NUMBER OF USERS
    if (lastCount > 3){
        SHAPE_TIME_LIMIT = 30 + (lastCount - 3) * 5;
    } else {
        SHAPE_TIME_LIMIT = 15;
    }

    // SET NEW END TIME
    shapeEndTime = Date.now() + SHAPE_TIME_LIMIT * 1000;

    // SEND TIMER TO CALL CLIENTS
    io.emit('shapeTimer', { timeLeft: SHAPE_TIME_LIMIT});

    // START COUNTDOWN
    shapeTimer = setTimeout(() => {
        rebuildShape(lastCount);
        startShapeTimer()
    }, SHAPE_TIME_LIMIT * 1000);
}

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});