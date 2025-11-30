const express = require('express');

const https = require("https");
const fs = require("fs");

const app = express();
const portHTTPS = 4230;

// when client request through https,
// server returns anything that is
// inside the public folder 
app.use(express.static('public'));

// Creating object of key and certificate for SSL
const options = {
    key: fs.readFileSync("keys-for-local-https/localhost-key.pem"),
    cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

let HTTPSserver = https.createServer(options, app)

const { Server } = require('socket.io'); // include library
const io = new Server(HTTPSserver); // start socket io 

let sockets = {};
let users = {};  
let avatars = {};

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on("identify", function(data){
        // console.log(data);

        // connect username and user id to socket ids
        sockets[socket.id] ={
            userId: data.userId,
            username: data.username
        }
        users[data.userId]= socket.id;

        console.log("currently online", sockets);
        // console.log(users);
    })

    socket.on('submit-avatar', (data) => {
        console.log('Avatar received:', data);

        // Extracting user ID
        const userInfo = sockets[socket.id];
        const myUserId = userInfo.userId;

        // Save avatar based on userId
        avatars[myUserId] = {
            username: userInfo.username,
            drawing: data
        };
        console.log('All Avatars received:', avatars);

        // Send to other users this info
        socket.broadcast.emit(
            'new-avatar', {
            userId: myUserId,
            username: userInfo.username,
            drawing: data
        });
    });

    socket.on("disconnect", function(){
        console.log("someone disconnected", socket.id);

        // delete user from our records
        let me = sockets[socket.id];
        if(me != undefined){
            delete sockets[socket.id];
            delete users[me.userId];
        }

        console.log("online socket", sockets);  
    })

})

// Creating servers and make them listen at their ports:
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});
