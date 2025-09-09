const MAX_BALLS = 7;
let circles = [];
let freezeTimer   = 1000;          // Timer for Multitouch, if all circles are touched within time frame.
let freezeDuration= 1000;          // Freeze the ball upon touch duration
let showTimer     = true;         // Show Timer on Canva or not
let timerRunning  = false;        // Start the timer
let difficulty    = 'Beginner';   // Difficulty of the 'Game'
let speedBoost    = 0.0;          // Make the ball float faster after each difficulty

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('p5-canvas-container');
  resetGame();
}

function draw() {
  background(201, 246, 255);
  let now = millis();

  /* Move & Wall-bounce + CLAMP (Prevent ball from sticking to the wall) */
  for (let c of circles) {
    if (now < c.frozenUntil) continue;

    c.x += c.vx;
    c.y += c.vy;
    c.x = constrain(c.x, c.r, width - c.r);
    c.y = constrain(c.y, c.r, height - c.r);

    if ((c.vx < 0 && c.x <= c.r) || (c.vx > 0 && c.x >= width - c.r))  c.vx *= -1;
    if ((c.vy < 0 && c.y <= c.r) || (c.vy > 0 && c.y >= height - c.r))  c.vy *= -1;
  }

  /* Bounce off one another + CLAMP */
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

  /* Draw circles */
  noStroke();
  for (let c of circles) {
    fill(c.flashFreeze ? color(100,200,255) : (c.flash ? color(140, 81, 40) : color(247, 167, 62)));
    circle(c.x, c.y, 2*c.r);
    c.flash = c.flashFreeze = false;
  }

  /* Display Text */
  textAlign(CENTER, TOP);
  textSize(50);
  fill(0);
  text(difficulty, width / 2, 10);
  textAlign(LEFT, BOTTOM);
  textSize(20);
  text(`Balls: ${circles.length} / ${MAX_BALLS - 1}`, 10, height - 10);
  textAlign(RIGHT, BOTTOM);
  if (showTimer) {
    if (timerRunning) {
        freezeTimer -= deltaTime;
        if (freezeTimer <= 0) {
            timerRunning = false;
            /* If the player does not touch all balls within period, */
            let allFrozen = circles.every(c => millis() < c.frozenUntil);
            if (!allFrozen && circles.length) {
              circles.pop();                               // penalty -> A Ball disaapears
            } else {
              circles.forEach(c => c.frozenUntil = 0);     // success -> Unfreeze
            }
        }
    }
    text(`Sync-Time Limit: ${max(0, freezeTimer/1000).toFixed(1)}s`, width - 10, height - 10);
  }
}

function touchStarted() {
  let now = millis();
  let hitSomething = false;

  for (let t of touches) {
    for (let c of circles) {
      if (dist(t.x, t.y, c.x, c.y) < c.r) {
        c.frozenUntil = now + freezeDuration;
        c.flashFreeze = true;
        hitSomething  = true;
      }
    }
  }
  if (hitSomething) console.log(touches);
  if (!hitSomething) return false;

  freezeTimer = freezeDuration;
  timerRunning = true;

  let allTouchedNow = circles.every(c => (now - c.frozenUntil + freezeDuration) <= freezeDuration);
  if (allTouchedNow) {
    if (circles.length < MAX_BALLS) {
      circles.push(makeCircle(random(80, width - 80), random(80, height - 80)));
      circles.forEach(c => c.frozenUntil = 0);
      timerRunning = false;

      if (circles.length === MAX_BALLS) {
        speedBoost += 0.5;
        if (difficulty === 'Beginner') {
          difficulty = 'Intermediate'; freezeDuration = 500; resetGame();
        } else if (difficulty === 'Intermediate') {
          difficulty = 'Hard'; freezeDuration = 250; resetGame();
        }
      }
    }
  }
  return false;
}

function touchMoved() { return false; }
function touchEnded() { return false; }

/* ---------- helpers ---------- */
function makeCircle(x,y){
  return {
    x:x, y:y, r:50,
    vx: ((random(-3, 3) * (0.2 + speedBoost))),
    vy: ((random(-3, 3) * (0.2 + speedBoost))),
    frozenUntil:0, flash:false, flashFreeze:false
  };
}

/* Reset Game to Start if one ball */
function resetGame() {
  circles = []; 
  circles.push(makeCircle(width / 2, height / 2));
  freezeTimer = freezeDuration; timerRunning = false;
}

function windowResized(){resizeCanvas(windowWidth, windowHeight); }