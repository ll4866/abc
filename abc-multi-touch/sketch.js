// ---------- bouncing-circles ----------
let circles = [];
let freezeTimer   = 5000;   // ms to show
let showTimer     = true;   // always shown
let timerRunning  = false;  // don't count until next hit
let difficulty    = 'Beginner'; // switches at 10 balls
let freezeDuration= 5000;   // current freeze length (ms)

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('p5-canvas-container');
  resetGame();               // start with 1 ball
}

function draw() {
  background(90, 200, 190);
  let now = millis();

  /* 1. move & wall-bounce (skip if frozen) + CLAMP */
  for (let c of circles) {
    if (now < c.frozenUntil) continue;

    c.x += c.vx;
    c.y += c.vy;

    c.x = constrain(c.x, c.r, width - c.r);
    c.y = constrain(c.y, c.r, height - c.r);

    if ((c.vx < 0 && c.x <= c.r) || (c.vx > 0 && c.x >= width - c.r))  c.vx *= -1;
    if ((c.vy < 0 && c.y <= c.r) || (c.vy > 0 && c.y >= height - c.r))  c.vy *= -1;
  }

  /* 2. circle–circle bounce (skip frozen pairs) + CLAMP */
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      let c1 = circles[i], c2 = circles[j];
      if (now < c1.frozenUntil || now < c2.frozenUntil) continue;
      let dx = c2.x - c1.x, dy = c2.y - c1.y, dist = sqrt(dx*dx + dy*dy);
      let minDist = c1.r + c2.r;
      if (dist < minDist && dist > 0) {
        let overlap = (minDist - dist)/2, ux = dx/dist, uy = dy/dist;
        c1.x -= ux*overlap; c1.y -= uy*overlap;
        c2.x += ux*overlap; c2.y += uy*overlap;

        c1.x = constrain(c1.x, c1.r, width - c1.r);
        c1.y = constrain(c1.y, c1.r, height - c1.r);
        c2.x = constrain(c2.x, c2.r, width - c2.r);
        c2.y = constrain(c2.y, c2.r, height - c2.r);

        let m1 = c1.r*c1.r, m2 = c2.r*c2.r;
        let relVel = (c1.vx - c2.vx)*ux + (c1.vy - c2.vy)*uy;
        let impulse = 2*relVel/(m1 + m2);
        c1.vx -= impulse*m2*ux; c1.vy -= impulse*m2*uy;
        c2.vx += impulse*m1*ux; c2.vy += impulse*m1*uy;
      }
    }
  }

  /* 3. draw circles */
  noStroke();
  for (let c of circles) {
    fill(c.flashFreeze ? color(100,200,255) : (c.flash ? color(255,100,100) : 0));
    circle(c.x, c.y, 2*c.r);
    c.flash = c.flashFreeze = false;
  }

  /* 4. ALWAYS-ON HUD */
  textAlign(CENTER, TOP);   // top-middle difficulty
  textSize(28);
  fill(0);
  text(difficulty, width / 2, 10);

  textAlign(LEFT, BOTTOM);  // bottom-left ball count
  text(`Balls: ${circles.length}`, 10, height - 10);
  
  textAlign(RIGHT, BOTTOM); // bottom-right freeze timer
  if (showTimer) {
    if (timerRunning) freezeTimer = max(0, freezeTimer - deltaTime);
    text(`Freeze: ${(freezeTimer/1000).toFixed(1)}s`, width - 10, height - 10);
    
    /* *****  NEW :  time-out → remove oldest ball  ***** */
    if (freezeTimer <= 0 && timerRunning) {
      timerRunning = false;
      if (!circles.every(c => (millis() - c.frozenUntil + freezeDuration) <= freezeDuration)) {
        circles.shift();          // oldest-created out
      }
    }
  }
}

/* ---------- touch ---------- */
function touchStarted() {
  let x = touches[0].x, y = touches[0].y;
  let now = millis();
  let hitSomething = false;

  for (let c of circles) {
    if (dist(x,y, c.x,c.y) < c.r) {
      hitSomething = true;
      console.log(touches);
      c.frozenUntil = now + freezeDuration;   // use current freeze length
      c.flashFreeze = true;
      break;
    }
  }

  if (!hitSomething) return false;

  freezeTimer = freezeDuration;
  timerRunning = true;

  let allRecent = circles.every(c => (now - c.frozenUntil + freezeDuration) <= freezeDuration);
  if (allRecent) {
    if (circles.length < 10) {                // normal spawn
      circles.push(makeCircle(random(80,width-80), random(80,height-80)));
      circles.forEach(c => c.frozenUntil = 0);
      timerRunning = false;

      /* PROMOTE & RESET at 10th ball */
      if (circles.length === 10) {
        if (difficulty === 'Beginner') {
          difficulty     = 'Intermediate';
          freezeDuration = 3000;   // drop to 3-second window
          resetGame();
        } else if (difficulty === 'Intermediate'){
          difficulty     = 'Hard';
          freezeDuration = 1000;   // drop to 1-second window
          resetGame();
        }
      }
    }
  }
  return false;
}

/* ---------- helpers ---------- */
function makeCircle(x,y){
  return {x,y, r:50, vx:random(-3,3), vy:random(-3,3), frozenUntil:0, flash:false, flashFreeze:false};
}

function resetGame() {          // single-ball restart
  circles = [];
  circles.push(makeCircle(width / 2, height / 2));
  freezeTimer   = freezeDuration;
  timerRunning  = false;
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

function touchMoved(){}
function touchEnded(){}