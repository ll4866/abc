// SOCKET VARIABLES
const prefix = location.pathname.replace(/\/$/, '');      
const socket = io({ path: prefix + '/socket.io' });

// username
let nameInput = document.querySelector("#nameWrapper input");
let nameBtn   = document.querySelector("#nameBtn");
let nameTag   = document.querySelector("#nameWrapper p");
let userName  = "";

// DEVICE ORIENTATION VARIABLES
let alpha, beta, gamma = 0;
let userCount = 0;   
const others = {}; 
let myX, myY;

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);

    myX = width / 2;
    myY = height / 2;

    canvas.parent("p5-canvas-container");
}

function draw() {
    background(90, 200, 190);

    // information
    noStroke();
    fill(0);
    text("alpha: " + round(alpha), width - 80, 30);
    text("beta: "  + round(beta),  width - 80, 40);
    text("gamma: " + round(gamma), width - 80, 50);

    // default center location
    if (gamma === undefined) gamma = 0;
    if (beta  === undefined) beta  = 0;

    // movement
    myX += gamma * 0.3;  
    myY += beta  * 0.3;
    myX = constrain(myX, 25, width -25);
    myY = constrain(myY, 25, height-25);
    
    // 30 fps of sending message of location to socket
    if (frameCount % 2 === 0) socket.emit('move', {x:myX, y:myY});
    
    // this user
    fill(255,0,0);
    ellipse(myX, myY, 50);
    textAlign(CENTER, CENTER);
    fill(255);
    text('Me', myX, myY);  
    // other users
    for (let [id,c] of Object.entries(others)){
        fill(0);
        ellipse(c.x, c.y, 50);
    }

    // number of users
    fill(255);
    text("phones: " + userCount, 10, 20);
    console.log("Number of Users:", userCount);   
}

socket.on('count', c => userCount = c);
socket.on('update', data => others[data.id] = {x:data.x, y:data.y});
socket.on('left',   id => delete others[id]);

function handleOrientation(eventData){
    document.querySelector('#requestOrientationButton').style.display = "none";
    // console.log(eventData.alpha, eventData.beta, eventData.gamma);
    
    alpha = eventData.alpha;
    beta = eventData.beta;
    gamma = eventData.gamma;      
}