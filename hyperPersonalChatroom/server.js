const express = require('express');
const https = require("https");
// to read certificates from the filesystem (fs)
const fs = require("fs");

const app = express(); // the server "app", the server behaviour
const portHTTPS = 3001; // port for https

// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));

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

    socket.on("message", function(incomingMessage){
        console.log("got a message", incomingMessage)

        // after receiving a msg from any one client,
        // we send them to all other clients;
        let messageToAllClients = {
            sender: "unknown",
            message: IncomingMessage
        }
        io.emit("newMessage", messageToAllClients);
    })

    socket.on('disconnect', function() {
        console.log('someone disconnected', socket.id);
    })
});

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});