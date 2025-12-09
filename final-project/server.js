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

let HTTPSserver = https.createServer(options, app);

const { Server } =  require('socket.io'); // include library;
const io = new Server(HTTPSserver);

let sockets = {};
let users = {};  
let avatars = {};

let lettersParticles = [];
const mapW = 2000;
const mapH = 2000;

// Load history if exists
const DATA_PATH = "game-data.json";
let history = { users: [], letters: [], animals: []};
try {
    if (fs.existsSync(DATA_PATH)) {
        const file = fs.readFileSync(DATA_PATH, 'utf8');
        history = JSON.parse(file);
        console.log('Loaded game history:', history.users.length, 'users,', history.letters.length, 'letters', history.animals.length, 'animals');
    }
} catch (err) {
    console.log('Could not load game history, starting empty');
    history = { users: [], letters: [], animals: []  };
}

// animal
let wanderingState = {};

if (history.animals && history.animals.length > 0) {
    for (let i = 0; i < history.animals.length; i++) {
        wanderingState[i] = {
            dirX: (Math.random() - 0.5) * 0.5,
            dirY: (Math.random() - 0.5) * 0.5,
            timeLeft: Math.random() * 2000 + 1000
        };
    }
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
        drawing: u.drawing || [],
        x: u.x || 0,
        y: u.y || 0,
        gamma: u.gamma || 0,
        beta: u.beta || 0,
        grabbing: u.grabbing || false
    };
});

// Create letters if not loaded or less than 500
if (history.letters.length === 0 || history.letters.length < 500) {
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
        drawing: a.drawing || [],
        x: a.x || 0,
        y: a.y || 0,
        gamma: a.gamma || 0,
        beta: a.beta || 0,
        grabbing: a.grabbing || false
    }));
    
    fs.writeFileSync(DATA_PATH, JSON.stringify(history, null, 2), 'utf-8');
}

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    
    socket.emit("letters-create", lettersParticles);

    // Send animal names
    const animalNames = Object.keys(animalData);
    socket.emit("animal-list", animalNames);

    socket.emit("restore-animals", history.animals.map(a => ({
        animal: a.animal,
        x: a.x,
        y: a.y,
        info: animalData[a.animal.toLowerCase()] || null
    })));    

    socket.on("identify", function(data){
        if (users[data.userId]) {
            let oldSocket = users[data.userId];
    
            // Remove old socket reference
            delete sockets[oldSocket];
        }

        if (avatars[data.userId]) {
            delete avatars[data.userId];
        }

        // connect username and user id to socket ids
        sockets[socket.id] ={
            userId: data.userId,
            username: data.username
        }
        users[data.userId]= socket.id;

        console.log("currently online", sockets);

        Object.values(avatars).forEach(a => {
            socket.emit('new-avatar', a);
        });
    })

    socket.on('submit-avatar', function (data) {
        // check if the user has identified first
        const userInfo = sockets[socket.id];
        const myUserId = userInfo.userId;
        // console.log('Avatar received:', data);

        // Save avatar based on userId
        avatars[myUserId] = {
            userId: myUserId,
            username: userInfo.username,
            drawing: data,
            x: avatars[myUserId]?.x || 0,
            y: avatars[myUserId]?.y || 0,
            gamma: avatars[myUserId]?.gamma || 0,
            beta: avatars[myUserId]?.beta || 0,
            grabbing: avatars[myUserId]?.grabbing || false
        };
        console.log('All Avatars received:', avatars);

        // Send to other users this info
        socket.broadcast.emit('new-avatar', avatars[myUserId]);

        // Send initial letters state to this user
        socket.emit("letters-create", lettersParticles);
        saveHistory();
    });

    socket.on("update-location", (data) => {
        // store location
        if (!avatars[data.userId]) return;
    
        avatars[data.userId].x = data.x;
        avatars[data.userId].y = data.y;
        avatars[data.userId].gamma = data.gamma;
        avatars[data.userId].beta = data.beta;
        avatars[data.userId].grabbing = data.grabbing;
    
        // broadcast to all other clients
        socket.broadcast.emit("location-update", data);
        saveHistory();
        // console.log("location update", data);
    });

    socket.on("push-letters", (updateLocation) => {
        const { index, x, y } = updateLocation;

        // Update internal server letter data
        lettersParticles[index].x = x;
        lettersParticles[index].y = y;
        // console.log(`Letter ${index} moved → x:${x} y:${y}`);
        saveHistory();

        // Broadcast to all OTHER players (not the sender)
        socket.broadcast.emit("letters-moved", {
            index,
            x,
            y
        });
    });

    socket.on("found-animal", function (data){
        const { animal, x, y } = data;
        const info = animalData[animal.toLowerCase()] || {};

        // Save to server history
        if (!history.animals) history.animals = [];
        history.animals.push({ animal, x, y});
        saveHistory();

        // create wander state for this new animal
        const idx = history.animals.length - 1;
        wanderingState[idx] = {
            dirX: (Math.random() - 0.5) * 0.5,
            dirY: (Math.random() - 0.5) * 0.5,
            timeLeft: Math.random() * 2000 + 1000
        };

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

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

setInterval(() => {

    if (!history.animals || history.animals.length === 0) return;

    const dt = 100; // ms per update

    for (let i = 0; i < history.animals.length; i++) {

        const a = history.animals[i];

        // Ensure wander state exists (new animals)
        if (!wanderingState[i]) {
            wanderingState[i] = {
                dirX: (Math.random() - 0.5) * 0.5,
                dirY: (Math.random() - 0.5) * 0.5,
                timeLeft: Math.random() * 2000 + 1000
            };
        }

        let ws = wanderingState[i];

        // Move
        let newX = a.x + ws.dirX;
        let newY = a.y + ws.dirY;

        // Bounce at edges
        if (newX <= 0 || newX >= mapW) ws.dirX *= -1;
        if (newY <= 0 || newY >= mapH) ws.dirY *= -1;

        // Clamp inside map
        a.x = clamp(newX, 0, mapW);
        a.y = clamp(newY, 0, mapH);

        // Timer change direction
        ws.timeLeft -= dt;
        if (ws.timeLeft <= 0) {
            ws.dirX = (Math.random() - 0.5) * 5;
            ws.dirY = (Math.random() - 0.5) * 5;
            ws.timeLeft = Math.random() * 2000 + 1000;
        }
    }

    // Save positions back into history
    saveHistory();

    // Send new positions to all clients
    io.emit("animals-update", history.animals);

}, 100);

// Creating servers and make them listen at their ports:
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});
