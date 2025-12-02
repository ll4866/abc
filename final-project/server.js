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

let lettersParticles = [];
const mapW = 2000;
const mapH = 2000;

// there are traps around the map
// terms like character wings, 4legs, big, small, .... to add to avatar
// can tap screen to duplicate and have an original (only if it is diff from original)
// dead creatures turn into a zombie which stays alive but disappear after a while

// Load history if exists
const DATA_PATH = "game-data.json";
let history = { users: [], letters: [] };
try {
    if (fs.existsSync(DATA_PATH)) {
        const file = fs.readFileSync(DATA_PATH, 'utf8');
        history = JSON.parse(file);
        console.log('Loaded game history:', history.users.length, 'users,', history.letters.length, 'letters');
    }
} catch (err) {
    console.log('Could not load game history, starting empty');
    history = { users: [], letters: [] };
}

// Load animal data
let animalData = {};
try {
    const file = fs.readFileSync('animal.json', 'utf8');
    const raw = JSON.parse(file);
    
    // create a lookup with lowercase keys
    animalData = {};
    for (let k in raw) {
        animalData[k.toLowerCase()] = raw[k];
    }

    console.log("Animal data loaded:", Object.keys(animalData));
} catch (err) {
    console.log("Could not load animal.json:", err);
}

// Restore avatars and positions from history
history.users.forEach(u => {
    avatars[u.userId] = {
        userId: u.userId,
        username: u.username,
        drawing: u.drawing || [], // empty until they submit avatar
        x: u.x || 0,
        y: u.y || 0
    };
});

// Create letters if not loaded
if (history.letters.length === 0) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < 500; i++) {
        lettersParticles.push({
            x: Math.random() * mapW,
            y: Math.random() * mapH,
            letter: letters[Math.floor(Math.random() * letters.length)]
        });
    }
} else {
    lettersParticles = history.letters;
}

// Save function
function saveHistory() {
    history.letters = lettersParticles;
    history.users = Object.values(avatars).map(a => ({
        userId: a.userId,
        username: a.username,
        x: a.x || 0,
        y: a.y || 0
    }));
    fs.writeFileSync(DATA_PATH, JSON.stringify(history, null, 2), 'utf-8');
}

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    
    socket.emit("letters-create", lettersParticles);

    // Send animal names
    const animalNames = Object.keys(animalData);
    socket.emit("animal-list", animalNames);

    socket.on("identify", function(data){
        // connect username and user id to socket ids
        sockets[socket.id] ={
            userId: data.userId,
            username: data.username
        }
        users[data.userId]= socket.id;

        console.log("currently online", sockets);
        // console.log(users);
    })

    socket.on('submit-avatar', function (data) {
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
        socket.broadcast.emit('new-avatar', {
            userId: myUserId,
            username: userInfo.username,
            drawing: data
        });

        // Send initial letters state to this user
        socket.emit("letters-create", lettersParticles);
        saveHistory();
    });

    socket.on("update-location", (data) => {
        // store location
        if (!avatars[data.userId]) return;
    
        avatars[data.userId].x = data.x;
        avatars[data.userId].y = data.y;
    
        // broadcast to all other clients
        socket.broadcast.emit("location-update", data);
        saveHistory();
        // console.log("location update", data);
    });

    socket.on("push-letters", (updatedSand) => {
        lettersParticles = updatedSand;
        io.emit("letters-create", lettersParticles);
        saveHistory();
    });

    socket.on("found-animal", function (data){
        const { animal, x, y } = data;
        const info = animalData[animal.toLowerCase()] || {};

        // Create object to send
        const payload = {
            animal,
            x,
            y,
            info
        };

        // Broadcast to all clients
        io.emit("animal-found", payload);
        console.log("Animal found:", payload);
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
        saveHistory();
    })

})

function random(min, max) {
    return Math.random() * (max - min) + min;
}

// Creating servers and make them listen at their ports:
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});
