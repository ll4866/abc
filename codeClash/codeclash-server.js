// Import dependencies
const express = require('express');
const https = require("https");
const fs = require("fs");
const { Server } = require('socket.io');

const app = express();
const portHTTPS = 4230; // your HTTPS port

// Serve anything inside the public folder
app.use(express.static('public'));

// SSL key and certificate for HTTPS
const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

// Create HTTPS server
const httpsServer = https.createServer(options, app);
const io = new Server(httpsServer);

// List of connected clients with their username and location
let currentlyConnected = {};

// Track teams and their progress (survives reconnections)
let teams = {
    red:    { players: [], code: null, completed: false },
    blue:   { players: [], code: null, completed: false },
    orange: { players: [], code: null, completed: false }
};

// Random code size
const codeSize = 8;
let gameStarted = false;

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initialize connection data
    currentlyConnected[socket.id] = {
        username: null,
        lat: 0,
        lon: 0,
        ready: false,
        team: null
    };

    // Handle team selection
    socket.on('selectTeam', function (data) {
        const { username, team } = data;

        // Save team and username
        currentlyConnected[socket.id].username = username;
        currentlyConnected[socket.id].team = team;

        // Add player to team if not already there
        if (!teams[team].players.includes(username)) {
            teams[team].players.push(username);
        }
        console.log(username, 'joined team', team);

        // Send current game state to rejoining player
        socket.emit('teamSelected', {
            team: team,
            teamData: teams[team],
            allTeams: teams
        });

        // Notify all players about team update
        io.emit('updateTeams', teams);
    });


    // Handle ready status
    socket.on('ready', function (data) {
        // Mark user as ready
        currentlyConnected[socket.id].ready = true;
        console.log(data.username, 'is ready');

        // Count ready players per team
        const readyPerTeam = {
            red:    Object.values(currentlyConnected).filter(u => u.ready && u.team === 'red').length,
            blue:   Object.values(currentlyConnected).filter(u => u.ready && u.team === 'blue').length,
            orange: Object.values(currentlyConnected).filter(u => u.ready && u.team === 'orange').length
        };
        console.log('Ready players per team:', readyPerTeam);

        // Check if at least one ready in each team
        if (readyPerTeam.red > 0 && readyPerTeam.blue > 0 && readyPerTeam.orange > 0) {
            // Mark game start
            gameStarted = true; 

            // Create random code
            let randomCode = [];
            for (let i = 0; i < codeSize; i++) {
                randomCode.push(Math.floor(Math.random() * 16));
            }

            // Calculate midpoint between players
            let sumLat = 0;
            let sumLon = 0;
            const allPlayers = Object.values(currentlyConnected);
            allPlayers.forEach(u => {
                sumLat += u.lat;
                sumLon += u.lon;
            });

            const centerLat = sumLat / allPlayers.length;
            const centerLon = sumLon / allPlayers.length;

            // Generate zone numbers (0–15) and shuffle
            let numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            shuffleArray(numbers);

            // Send start to all users with important info
            io.emit('startGame', { centerLat, centerLon, numbers, randomCode });
            console.log('All users ready, starting game at center:', centerLat, centerLon);
            console.log('Random code is:', randomCode);
        } else {            
            // Count how many teams have at least one ready player
            let count = 0;
            if (readyPerTeam.red > 0) count++;
            if (readyPerTeam.blue > 0) count++;
            if (readyPerTeam.orange > 0) count++;

            // Send to all about how many clases are ready
            io.emit('updateReadyCount', count);
            console.log('Classes ready:', count);
        }
    });

    // Listening for the location of all clients
    socket.on('locationFromClient', function (data) {
        // update location data
        currentlyConnected[socket.id].username = data.username;
        currentlyConnected[socket.id].lat = data.lat;
        currentlyConnected[socket.id].lon = data.lon;

        // Share location with everyone except the sender
        let locationInfo = {
            lat: data.lat,
            lon: data.lon,
            user: data.username,
            team: currentlyConnected[socket.id].team
        };
        
        // Send to all other users location
        socket.broadcast.emit('locationFromServer', locationInfo);
    });

    // Listening if any player has completed their code
    socket.on('submitCode', function (data) {        
        // End the game
        gameStarted = false; 

        // Reset all users' ready state so they can press ready again
        for (let userId in currentlyConnected) {
            currentlyConnected[userId].ready = false;
        }

        // send to all that game is over and who won and their team
        io.emit('endGame', data);
        console.log(data.username, 'has completed their code', data.team);
    });
    
    // Listening for when a user is attempting their code
    socket.on('state', function (data) {
        console.log('user:', data, 'attempting code');

        // send to all which user is attempting their code
        io.emit('updateState', data);
    });

    // Disconnect handler
    socket.on("disconnect", function () {
        console.log("Someone disconnected:", socket.id);
        
        // Get the username and team of the disconnecting user
        const username = currentlyConnected[socket.id].username;
        const team = currentlyConnected[socket.id].team;
        
        // Remove user from list
        delete currentlyConnected[socket.id];
        // console.log('Updated list of connected users:', currentlyConnected);

        // Notify others
        if (username) {
            socket.broadcast.emit('userThatLeft', { username, team });
        }

        // Update teams display
        io.emit('updateTeams', teams);
    });
});

// Shuffle Array order of zone numbers
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Start HTTPS server
httpsServer.listen(portHTTPS, () => {
    console.log("HTTPS Server started at port", portHTTPS);
});