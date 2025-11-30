const express = require('express');

const https = require("https");
// to read certificates from the filesystem (fs)
const fs = require("fs");

const app = express(); // the server "app", the server behaviour
const portHTTPS = 4230; // port for https




// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));

app.post('/upload-photo', (req, res) => {
  console.log("someone upload photo")
  const filename = Date.now() + '.png';     // simple readable filename
  const filepath = 'public/uploads/' + filename;

  const writeStream = fs.createWriteStream(filepath);
  req.pipe(writeStream);

  req.on('end', () => {
    res.json({ url: 'uploads/' + filename });
  });
});

// Creating object of key and certificate
// for SSL
const options = {
    key: fs.readFileSync("keys-for-local-https/localhost-key.pem"),
    cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

let HTTPSserver = https.createServer(options, app)




const { Server } = require('socket.io'); // include library
const io = new Server(HTTPSserver); // start socket io 


io.on('connection', (socket) => {

    // we manage the connection inside here
    console.log('a user connected', socket.id);

 
    socket.on("disconnect", function(){
        console.log("someone disconnected", socket.id)

        
    })

})




// Creating servers and make them listen at their ports:

HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});





