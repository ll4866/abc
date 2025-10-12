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

let shapeVertexes = [];
let lastCount     = 0;  
let minW          = Infinity;
let minH          = Infinity;
io.on('connection', function(socket){
    console.log('a user connected', socket.id);

    socket.on('count', function(data) {
        if (data.w < minW) {
            minW = data.w;
        }
        if (data.h < minH) {
            minH = data.h;
        }
        // console.log('size', minW, minH);

        if (data.c !== lastCount) {
            lastCount = data.c;
            // console.log(data.c);
            shapeVertexes = [];
            for (let i = 0; i < data.c; i++) {
                shapeVertexes.push({
                    x: Math.random() * minW,
                    y: Math.random() * minH
                });
            }
            // console.log(shapeVertexes);
            io.emit('shape', shapeVertexes); 
        }
    });

    // LISTENING FOR POSITION FROM OTHERS
    socket.on('move', function(posData){
        // console.log('Locator:', position);
        io.emit('update', posData);
    });

    socket.on('chat', function(data){
        console.log('Message:', data);
        io.emit('allChat', data);
    });

    socket.on('disconnect', function() {
        console.log('someone disconnected', socket.id);
        io.emit('left', socket.id);
    });
});

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});