const express = require('express');
const https = require("https");
// to read certificates from the filesystem (fs)
const fs = require("fs");

const app = express(); // the server "app", the server behaviour
const portHTTPS = 4230; // port for https

// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));

const names = {}; 

// Creating object of key and certificate
// for SSL
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
    
    socket.on('move', function(pos){
        pos.name = names[socket.id]
        socket.broadcast.emit('update', {id:socket.id, ...pos});
    });

    socket.on('chat', function(data){
        data.id = socket.id; 
        socket.broadcast.emit('chat', data);
    });

    socket.on('freeze', function(data) {
        socket.broadcast.emit('freeze', {partner: socket.id});
    });
    
    socket.on('colour', data => {
        socket.broadcast.emit('colour', data);   // stamp partner blue on all screens
    });

    socket.on('disconnect', function() {
        console.log('someone disconnected', socket.id);
        socket.broadcast.emit('left', socket.id);
        io.emit('count', io.engine.clientsCount);
    });

    io.emit('count', io.engine.clientsCount);
});

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});