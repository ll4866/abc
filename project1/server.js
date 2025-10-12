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

io.on('connection', function(socket){
    console.log('a user connected', socket.id);
    
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