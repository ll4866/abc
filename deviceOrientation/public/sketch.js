let alpha, beta, gamma = 0;
let targetAlpha, targetBeta, targetGamma = 0;

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  targetAlpha = random(0,360);
  targetBeta = random(-180,180);
  targetGamma = random(-90,90);
}

function draw() {
  background(90, 200, 190);
  
  noStroke();

  // push();
  //   translate(width/2, height/2);
  //   rotate(radians(alpha))
    
  //   // black rectangle
  //   fill(0);
  //   rect(-100, -100, 200, 200);
    
  //   // red circle
  //   fill(255, 0, 0);
  //   circle(0, -100, 5)
  // pop();

  fill(0);
  text("alpha: " + round(alpha), 10, 30);
  text("beta: " + round(beta), 10, 40);
  text("gamma: " + round(gamma), 10, 50);

  // Distance btw Phone and Target
  const SCALE = 4; // pixels per degree

  let disAlpha = alpha - targetAlpha;
  /* convert (0,360) to (-180, 180) for better calculation: https://www.orbiter-forum.com/threads/looking-for-formula-to-convert-0-to-360-to-180-to-180.20767/post-320248
  */
  disAlpha = ((disAlpha + 180) % 360) - 180;    
  let distBeta  = beta - targetBeta;

  //xy-coordinate = Center + diff (up, down, right left)
  let drawX = width/2  + disAlpha * SCALE;
  let drawY = height/2 + distBeta * SCALE;

  // Calculate distance it is from the target
  let d = sqrt(disAlpha*disAlpha + distBeta*distBeta );
  let withinZone = 60;

  // Color Change if apprach zone range
  if (d < withinZone/3){
    fill(0, 255, 0);
  } else { 
    fill(255, 0, 0);
  }
  circle(drawX, drawY, 30);

  // Target drawing
  stroke(255,0,0);
  strokeWeight(1);
  fill(0,0,0,10);
  circle(width/2, height/2, 120);  
  fill(255,0,0);
  circle(width/2, height/2, 5);  
}

// P5 touch events: https://p5js.org/reference/#Touch 

function touchStarted() {
  console.log(touches);
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