'use strict';

const RESOLUTION = 60;
const BLOCK_DENSITY = 0.8;
const RANDOM_MOVE_CHANCE = 0.05;
const DEBUG = false;
const LEARNING_RATE = 0.2;
const REWARD_DISCOUNT_FACTOR = 0.99;
const INITIAL_WEIGHT = 0.2;
const FRAME_RATE = 30;

let grid;
let mouse;
const rand = new Math.seedrandom(99);
const wrand = new Math.seedrandom(101);
const mrand = new Math.seedrandom(102);
const inGrid = (x, y) => (grid.length && x < grid.length && x >= 0 && grid[x].length && y < grid[x].length && y >=0);
let generation;
let bestSteps;
let generationDiv;
let bestStepsDiv;
let frameRateDiv;
let ticking = false;

class Cell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    if (rand() > BLOCK_DENSITY) {
      this.block = true;
    }
    this.neighbors = [];
    this.table = [];
  }
  
  addNeighbor(c) {
    this.neighbors.push(c);
    this.table.push(INITIAL_WEIGHT);
  }
  
  updateNeighbor(n, w) {
    const i = this.neighbors.indexOf(n);
    if (DEBUG) console.log('update neighor', n, 'index', i, 'to weight', w);
    if (i >= 0) this.table[i] = w;
  }
  
  getNeighborWeight(n) {
    const i = this.neighbors.indexOf(n);
    return i >= 0 ? this.table[i] : 0;
  }
  
  bestNeighbor(excludes = []) {
    if (!this.neighbors.length) return null;
    let b;
    for (let n of this.neighbors) {
      if (excludes.includes(n)) continue;
      if (!b || this.getNeighborWeight(n) > this.getNeighborWeight(b)) {
        b = n;
      }
    }
    return b;
  }
  
  draw() {
    stroke(255, 255, 255);
    if (this.block) {
      fill(255);
    } else {
      noFill();
    }
    rect(this.x * RESOLUTION, this.y * RESOLUTION, RESOLUTION, RESOLUTION);
    
    textAlign(CENTER);
    if (this.target) {
      text('cheese', this.x * RESOLUTION + RESOLUTION/2, this.y * RESOLUTION + RESOLUTION/2 + 2);
    } else {
      const b = this.bestNeighbor();
      text(b ? this.getNeighborWeight(b).toFixed(2) : 0, this.x * RESOLUTION + RESOLUTION/2, this.y * RESOLUTION + RESOLUTION/2 + 2);
    }
  }
}

class Mouse {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.path = [];
  }
  
  draw() {
    textAlign(CENTER);
    text('M', this.x * RESOLUTION + RESOLUTION/2, this.y * RESOLUTION + RESOLUTION/4);
    
    for (let p of this.path) {
      text('m', p.x * RESOLUTION + RESOLUTION/2, p.y * RESOLUTION + RESOLUTION/4);
    }
  }
  
  move() {
    // maintain path
    if (this.dead) return;
    if (DEBUG) console.log('mouse', this);
    const c = grid[this.x][this.y];
    this.path.push(c);
    
    // get the neighbors
    let b = c.bestNeighbor(this.path);
    
    if (DEBUG) console.log('best neighbor', b);
    
    // check if we have died
    if (this.path.includes(b) || !b) {
      this.dead = true;
      if (DEBUG) console.log('DEAD');
      return;
    } else if (b.target) {
      this.dead = true;
      this.reach = b;
      if (DEBUG) console.log('REACHED');
      return;
    }
    
    // move the mouse
    const i = Math.trunc(mrand() * c.neighbors.length);
    const n = mrand() < RANDOM_MOVE_CHANCE ? c.neighbors[i] : b;
    this.x = n.x;
    this.y = n.y;
  }
}

function learn() {
  if (mouse.reach) if (!bestSteps || bestSteps > mouse.path.length) bestSteps = mouse.path.length;
  generation++;
  let reward = mouse.reach ? 1 : 0;
  let factor = pow(REWARD_DISCOUNT_FACTOR, mouse.path.length);
  let previous = mouse.reach;
  for (let i = mouse.path.length - 1; i >= 0; i--) {
    const current = mouse.path[i];
    current.updateNeighbor(previous, (1 - LEARNING_RATE) * current.getNeighborWeight(previous) + LEARNING_RATE * reward * factor);
    previous = current;
    if (DEBUG) {
      console.log('current', current);
      console.log('previous', previous);
    }
  }
}

function setup() {
  frameRate(FRAME_RATE);
  createCanvas(600, 600);
  background(0);
  generationDiv = createDiv();
  bestStepsDiv = createDiv();
  frameRateDiv = createDiv();
  init();
}

function init() {
  const nx = 600 / RESOLUTION;
  const ny = 600 / RESOLUTION;
  grid = [];
  for (let i = 0; i < nx; i++) {
    grid.push([]);
    for (let j = 0; j < ny; j++) {
      grid[i].push(new Cell(i, j));
    }
  }
  for (let gs of grid) {
    for (let cell of gs) {
      const i = cell.x;
      const j = cell.y;
      if (inGrid(i - 1, j) && !grid[i-1][j].block) {
        cell.addNeighbor(grid[i-1][j]);
      }
      if (inGrid(i, j - 1) && !grid[i][j-1].block) {
        cell.addNeighbor(grid[i][j-1]);
      }
      if (inGrid(i + 1, j) && !grid[i+1][j].block) {
        cell.addNeighbor(grid[i+1][j]);
      }
      if (inGrid(i, j + 1) && !grid[i][j+1].block) {
        cell.addNeighbor(grid[i][j+1]);
      }
    }
  }
  
  grid[nx-1][ny-1].target = true;
  mouse = new Mouse(0, 0);
  generation = 0;
  tick();
}

function tick() {
  ticking = true;
  if (mouse.dead) {
    learn();
    mouse = new Mouse(0, 0);
  }
  
  mouse.move();
  ticking = false;
  setTimeout(tick, 1);
}

function draw() {
  background(0);
  
  generationDiv.html('Generation: ' + generation);
  bestStepsDiv.html('Best Steps: ' + (bestSteps || 'N/A'));
  frameRateDiv.html('Frame rate: ' + frameRate().toFixed(0));
  
  if (ticking) return;
  
  for (let gs of grid) {
    for (let cell of gs) {
      cell.draw();
    }
  }
  mouse.draw();
}
