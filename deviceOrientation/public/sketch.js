let alpha, beta, gamma = 0;
let targetAlpha, targetBeta, targetGamma = 0;

let buttonW = 100;
let buttonH = 60;

let score = 0;
let scorePending = false;

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  targetAlpha = 0;//random(0,360);
  targetBeta = 0;//random(-180,180);
  // targetGamma = random(-90,90);
}

function draw() {
  background(90, 200, 190);
  
  // Information 
  noStroke();
  fill(0);
  text("alpha: " + round(alpha), width - 80, 30);
  text("beta: " + round(beta), width - 80, 40);
  text("gamma: " + round(gamma), width - 80, 50);

  // Drawing the Target
  // Distance btw Phone and Target
  const SCALE = 4;

  let disAlpha = alpha - targetAlpha;
  /* convert (0,360) to (-180, 180:
   https://www.orbiter-forum.com/threads/looking-for-formula-to-convert-0-to-360-to-180-to-180.20767/post-320248
  */
  disAlpha = ((disAlpha + 180) % 360) - 180;    
  let distBeta  = beta - targetBeta;

  // XY Distance
  let d = sqrt(disAlpha*disAlpha + distBeta*distBeta );
  let withinZone = 60;
  
  // XY-coordinate = Center + diff (up, down, right left)
  let drawX = width/2  + disAlpha * SCALE;
  let drawY = height/2 + distBeta * SCALE;  

  // Color Change if apprach zone range
  if (d < withinZone/3){
    fill(255, 0, 0);
  } else { 
    fill(60);
  }

  // spider
  push();
    translate(drawX, drawY);
    scale(0.5);
      
    // fangs
    ellipse(60, 10, 30, 8);
    ellipse(60, -10, 30, 8);

    // legs
    noStroke();
    for (let side of [-1, 1]) {               // left / right
      for (let i = 0; i < 4; i++) {           // four legs per side
        push();
        rotate(side * (20 + i * 17));         
        for (let j = 0; j < 3; j++) ellipse(j * 23, 0, 30, 8);
        translate(60, 0);
        rotate(side * 24.5);
        for (let j = 0; j < 2; j++) ellipse(j * 15, 0, 17, 6);
        pop();
    }
    }

    // head 
    ellipse(30, 0, 60, 30);

    // Color Change if apprach zone range
    if (d < withinZone/3){
      fill(200, 0, 0);
    } else { 
      fill(0);
    }

    // abdomen
    ellipse(-10, 0, 90, 50);
    ellipse(-10, 0, 80, 40);

    // eyes 
    fill(255);
    stroke(0);
    circle(45, -8, 15);
    circle(45, 8, 15);
    fill(0);
    circle(45, -8, 5);
    circle(45, 8, 5);
  pop();

  // scoring
  if (scorePending && d < 5) {   
    score++;
    scorePending = false;
    newTarget();
  }

  // Target drawing
  push();
    translate(width/2, height/2);
    stroke(255,0,0);
    strokeWeight(1);
    fill(0, 0, 0, 50);
    circle(0,0, 120);  
    fill(255,0,0);
    circle(0,0, 5);  
    noStroke();
    fill(0);
    textAlign(CENTER, CENTER);
    text("Score:" + score, 0, -80);
  pop();

  // Capture button
  push();
    translate(width/2, height - 80);
    noStroke();
    fill(0,0,0, 220);
    rectMode(CENTER);
    rect(0, 0, buttonW, buttonH, 8);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("Exterminate", 0, 0);
  pop();
}

function newTarget() {
  targetAlpha = random(360);   // 0-360
  targetBeta  = random(-180, 180);
  targetGamma = random(-90, 90);
}

// P5 touch events: https://p5js.org/reference/#Touch 

function touchStarted() {
  let x = width/2 - buttonW/2;
  let y = height - 80 - buttonH/2;

  for (let t of touches) {
    if (t.x > x && t.x < x + buttonW && t.y > y && t.y < y + buttonH) {
      console.log('touch');
      scorePending = true;   // ask to score, don't score yet
      return false;
    }
  }
}

function touchMoved() {
}

function touchEnded() {
  scorePending = false; 
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

function handleOrientation(eventData){
  document.querySelector('#requestOrientationButton').style.display = "none";

  console.log(eventData.alpha, eventData.beta, eventData.gamma);
  
  alpha = eventData.alpha;
  beta = eventData.beta;
  gamma = eventData.gamma;
}