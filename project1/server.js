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
let maxTilt             = 20;
let boost               = 1;
io.on('connection', function(socket){
    console.log('a user connected', socket.id);

    // LISTENING FOR NUMBER OF DEVICES
    // IF CHANGED, MAKE A NEW SHAPE
    // SEND TO ALL NEW SHAPE
    socket.on('count', function(data) {
        if (data.c !== lastCount) {
            // recording smallest canvas
            if (data.w < minW) {
                minW = data.w;
            }
            if (data.h < minH) {
                minH = data.h;
            }
            // console.log('size', minW, minH);
            
            // record new count
            // console.log(data.c);
            lastCount = data.c;
            
            // new shape
            shapeVertexes = [];
            for (let i = 0; i < data.c; i++) {
                shapeVertexes.push({
                    x: Math.random() * minW,
                    y: Math.random() * minH
                });
            }
            // console.log(shapeVertexes);

            // SENDING made shape to all users
            io.emit('shape', shapeVertexes); 
        }
    });

    // LISTENING FOR POSITION FROM OTHERS
    // SENDING TO ALL THIS INFO
    socket.on('move', function(posData){
        // console.log('Locator:', position);
        io.emit('update', posData);
    });

    // LISTENING FOR CHAT FROM OTHERS
    // SENDING TO ALL THIS INFO
    socket.on('chat', function(data){
        console.log('Message:', data);
        io.emit('allChat', data);
    });

    // LISTENING FOR TILT FROM OTHERS
    // SENDING TO ALL THIS INFO
    socket.on('tilt', function( t ) {
        // console.log(t);

        // looking based on id if there is a match
        const idx = tilts.findIndex(e => e.id === (t.id || this.id));
        if (idx === -1) {
            // if no match, add into array
            tilts.push({ 
                id: t.id || this.id, 
                gamma: t.g, 
                beta: t.b 
            });
            // console.log('[TILT-ADD]', tilts);
        } else { 
            // if there is a match, 
            // if there is a change, update array
            const old = tilts[idx];
            if (old.gamma !== t.g || old.beta !== t.b) {
                old.gamma = t.g;
                old.beta  = t.b;
                // console.log('[TILT-UPDATE]', tilts);
            }
        }

        // needs more than one tilt to compare
        if (tilts.length >= 2) {
            // look for any user that tilt above absolute 50
            const crossed = tilts.filter(function(t){
                return Math.abs(t.gamma) > maxTilt || Math.abs(t.beta) > maxTilt;
            });
            // if more than 2 users crossed
            if (crossed.length >= 2) {
                // console.log('[2-TILT-CROSSED]', tilts);
                
                // count how many user go above in what direction
                const counters = {
                    gammaPos: 0, gammaNeg: 0,
                    betaPos:  0, betaNeg:  0
                };

                // add to count if a user is above 50
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

                // check if any count is above 2
                const ok = Object.values(counters).some(c => c >= 2);                if (ok) {
                    // console.log('condition met');
                    boost = 2.5;
                    io.emit('allTilt', boost);
                }
            } else {
                // normal boost if none of the condition is met
                boost = 1;
                io.emit('allTilt', boost);
                // console.log('condition not met');
            }
        } 
    });

    // LISTENING FOR A USER LEAVING
    // SENDING TO ALL THIS INFO
    socket.on('disconnect', function() {
        console.log('someone disconnected', socket.id);
        io.emit('left', socket.id);

        const idx = tilts.findIndex(e => e.id === socket.id);
        if (idx !== -1) {
            tilts.splice(idx, 1); 
        }
    });
});

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});