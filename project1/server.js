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
let lastCount           = 0;
let minW                = Infinity;
let minH                = Infinity;  
let tilts               = [];
let maxTilt             = 30;
let boost               = 5;
let noBoost             = 1;

/* USER TESTING: 
✅ REMOVING TRANSLATION (DISTRACTING) maybe as a next LEVEL
- LOOS LIKE CONSTELLATION COULD CONNECT AND FURTHER (SET PATTERN)
- SCORING / TIMING SYSTEM TO MATCH GOAL SHAPE
- NAMING TO KNOW WHO IS WHO
- INSTRUCTIONS ON SCREEN TO KNOW WHAT TO DO
✅ MESSAGE FIXES (ENABLE)
*/

io.on('connection', function(socket){
    console.log('a user connected', socket.id);

    // LISTENING FOR NUMBER OF DEVICES
    // IF NUMBER CHANGED, MAKE A NEW SHAPE
    // SEND TO ALL CLIENTS NEW SHAPE
    socket.on('count', function(data) {
        if (data.c !== lastCount) {
            // RECORDING SMALLEST CANVAS
            if (data.w < minW) {
                minW = data.w;
            }
            if (data.h < minH) {
                minH = data.h;
            }
            // console.log('size', minW, minH);
            
            // RECORD NEW COUNT OF DEVICES
            // console.log(data.c);
            lastCount = data.c;
            
            // CREATE SHAPE
            shapeVertexes = [];
            for (let i = 0; i < data.c; i++) {
                shapeVertexes.push({
                    x: Math.random() * minW,
                    y: Math.random() * minH
                });
            }

            // SENDING TO ALL CLIENTS SHAPE
            io.emit('shape', shapeVertexes); 
            // console.log(shapeVertexes);
        }
    });

    // LISTENING FOR POSITION FROM OTHERS
    // SENDING TO ALL CLEINTS THIS INFO
    socket.on('move', function(posData){
        // console.log('Locator:', position);
        io.emit('update', posData);
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
        // SEARCH FOR CLIENT MATCH STORED ID
        const idx = tilts.findIndex(e => e.id === (t.id || this.id));
        // IF NO MATCH
        if (idx === -1) {
            // ADD NEW ID
            tilts.push({ 
                id: t.id || this.id, 
                gamma: t.g, 
                beta: t.b 
            });
            // console.log('[TILT-ADD]', tilts);
        } else { 
            const old = tilts[idx];
            // UPDATE ARRAY VALUES IF THERE IS A CHANGE
            if (old.gamma !== t.g || old.beta !== t.b) {
                old.gamma = t.g;
                old.beta  = t.b;
                // console.log('[TILT-UPDATE]', tilts);
            }
        }

        // REQUIRE > 1 TILT
        if (tilts.length >= 2) {

            // SEARCH AND STORE NUMBER OF CLIENTS WITH >|maxTilt|
            const crossed = tilts.filter(function(t){
                return Math.abs(t.gamma) > maxTilt || Math.abs(t.beta) > maxTilt;
            });

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

        // console.log('otherTilt', {id: t.id, b:  t.b, g:  t.g});
        io.emit('otherTilt', {
            id: t.id,
            b:  t.b,
            g:  t.g
        });
    });

    // LISTENING FOR A LEAVING CLIENT
    // SENDING TO ALL CLIENTS THIS INFO
    // ERASE THAT CLIENT FROM DATA
    socket.on('disconnect', function() {
        console.log('someone disconnected', socket.id);
        io.emit('left', socket.id);

        // REMOVE TILT CLIENT
        const idx = tilts.findIndex(e => e.id === socket.id);
        if (idx !== -1) {
            tilts.splice(idx, 1); 
        }
    });
});

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});