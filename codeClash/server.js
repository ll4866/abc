const express = require('express');

const https = require("https");
// to read certificates from the filesystem (fs)
const fs = require("fs");
const app = express(); // the server "app", the server behaviour
const portHTTPS = 4230; // YOUR port

// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));

// Creating object of key and certificate
// for SSL
const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

let HTTPSserver = https.createServer(options, app)

const { Server } = require('socket.io'); // include library
const io = new Server(HTTPSserver); // start socket io 

// list of connected clients with their username and location
let currentlyConntected = {}; 
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    // keep track of all clients connected
    // have default be intialized as nothing, location 0
    currentlyConntected[socket.id] = {
        username: null,
        lat: 0,
        lon: 0,
        ready: false
    };

    // listening when all clients are ready to start the game
    socket.on('ready', function(data){
        // mark users that are ready
        currentlyConntected[socket.id].ready = true;
        console.log(data.username, 'is ready');
    
        // Count how many users are ready conpared to total number of users
        const readyUsers = Object.values(currentlyConntected).filter(u => u.ready).length;
        const totalUsers = Object.keys(currentlyConntected).length;

        // If more than 3 users and all are ready, start game
        if (totalUsers >= 3 && readyUsers === totalUsers) {
            let sumLat = 0;
            let sumLon = 0;
            let count = 0;

            // Calculate: Adding all lat and lon of all users together
            for (let userId in currentlyConntected) {
                sumLat += currentlyConntected[userId].lat;
                sumLon += currentlyConntected[userId].lon;
                count++;
            }

            // Dividing the sum lon and lat to get center point
            const centerLat = sumLat / totalUsers;
            const centerLon = sumLon / totalUsers;

            // Generating zone with numbers from 0-9
            let numbers = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
            shuffleArray(numbers); // randomize order

            // Send to all user this information
            io.emit('startGame', { centerLat, centerLon, numbers});
            console.log('All users ready, starting game at center:', centerLat, centerLon);
        }
    })

    // listening for the location of all clients
    socket.on('locationFromClient', function(data){
        // Update this user's info
        currentlyConntected[socket.id] = {
            username: data.username,
            lat: data.lat,
            lon: data.lon
        };
        // console.log('location of users:', currentlyConntected);

        // share the location with everybody except the sender
        let locationInfo = {
            lat: data.lat,
            lon: data.lon,
            user: data.username
        }
        socket.broadcast.emit('locationFromServer', locationInfo);
        // console.log('send other user location to others');
    })

    // listening if any player has completed their code
    socket.on('submitCode', function(data){
        console.log(data.username, 'has completed their code', data.code);

        // notify all users game is over
        io.emit('endGame', data);
    })

    // DISCONNECT
    socket.on("disconnect", function(){
        console.log("someone disconnected", socket.id)
        
        const username = currentlyConntected[socket.id].username;

        // Remove user from currentlyConntected object
        delete currentlyConntected[socket.id];
        console.log('Updated list of connected users:', currentlyConntected);

        // Notify everyone of the user leaving
        if(username) {
            socket.broadcast.emit('userThatLeft', username);
        }
    })

})

// Shuffle Array order of zone numbers
function shuffleArray(array) {
    // Starting from the last element number
    for (let i = array.length - 1; i > 0; i--) {
        // pick a random number to swap with
        const j = Math.floor(Math.random() * (i + 1));
        
        // switch its value with an element before it
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Creating https server by passing
// options and app object
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});