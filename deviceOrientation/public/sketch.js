let alpha, beta, gamma = 0;
let targetAlpha, targetBeta, targetGamma = 0;
let captured = false;
let buttonW = 100;
let buttonH = 60;
let score = 0;

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  targetAlpha = random(0,360);
  targetBeta = random(-180,180);
  targetGamma = random(-90,90);
}

function draw() {
  background(90, 200, 190);
  
  // ----- Information ------
  noStroke();
  fill(0);
  text("alpha: " + round(alpha), 10, 30);
  text("beta: " + round(beta), 10, 40);
  text("gamma: " + round(gamma), 10, 50);

  // ------ Drawing the Target -----
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
    fill(0, 255, 0);
  } else { 
    fill(255, 0, 0);
  }
  circle(drawX, drawY, 30);

  // Target drawing
  if(d < 5 && captured == true){
    score++;
    captured = false;
    newTarget();
  }
  push();
    translate(width/2, height/2);
    stroke(255,0,0);
    strokeWeight(1);
    fill(0,0,0,10);
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
    translate(width - 80, height - 80);
    noStroke();
    fill(0,0,0, 220);
    rectMode(CENTER);
    rect(0, 0, buttonW, buttonH, 8);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("Capture", 0, 0);
  pop();
}

function newTarget() {
  targetAlpha = random(360);   // 0-360
  targetBeta  = random(-180, 180);
  targetGamma = random(-90, 90);
}

// P5 touch events: https://p5js.org/reference/#Touch 

function touchStarted() {
  let x = width - 80 - buttonW/2;
  let y = height - 80 - buttonH/2;

  for (let t of touches) {
    if (t.x > x && t.x < x + buttonW && t.y > y && t.y < y + buttonH) {
      captured = true;
      return false; 
    }
  }
}

function touchMoved() {
}

function touchEnded() {
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