'use strict';

const RESOLUTION = 600/12;
const RANDOM_MOVE_CHANCE = 0.05;
const DEBUG = false;
const LEARNING_RATE = 0.2;
const REWARD_DISCOUNT_FACTOR = 0.99;
const INITIAL_WEIGHT = 0.2;
const FRAME_RATE = 30;

let grid;
let mouse;
let worldGenerator;
const rand = new Math.seedrandom(99);
const wgrand = new Math.seedrandom(1001);
const wrand = new Math.seedrandom(101);
const mrand = new Math.seedrandom(102);
let generation;
let bestSteps;
let generationDiv;
let bestStepsDiv;
let frameRateDiv;
let ticking = false;

const hash = c => c.x + ',' + c.y;
const inGrid = (grid, x, y) => (grid.length && x < grid.length && x >= 0 && grid[x].length && y < grid[x].length && y >=0);
const getNeighbors = (grid, x, y) => [[x-1,y],[x,y-1],[x+1,y],[x,y+1]].filter(coord => inGrid(grid, coord[0], coord[1])).map(coord => grid[coord[0]][coord[1]]);
const getUnvisitedNeighbors = (visited, grid, x, y) => getNeighbors(grid, x, y).filter(c => !visited[hash(c)]);


class Cell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
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
    stroke(255);
    noFill();
    getNeighbors(grid, this.x, this.y).filter(c => !this.neighbors.includes(c)).forEach(n => {
      stroke(255);
      const diffX = n.x - this.x;
      const diffY = n.y - this.y;
      if (DEBUG) console.log('draw wall between ', this, 'and', n);
      line(
        this.x * RESOLUTION + (diffX == 1 ? RESOLUTION : 0),
        this.y * RESOLUTION + (diffY == 1 ? RESOLUTION : 0),
        this.x * RESOLUTION + (diffX == -1 ? 0 : RESOLUTION),
        this.y * RESOLUTION + (diffY == -1 ? 0 : RESOLUTION)
      );
    });

    textAlign(CENTER);
    stroke(255);
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

class WorldGenerator {
  constructor(rng) {
    this.rng = rng;
  }

  // return a 2d array of Cell, each has a list of neighbors generated randomly
  // nx and ny are number of cells in x and y directions
  generate(nx, ny) {
    // generate empty grid first
    let grid = [];
    for (let i = 0; i < nx; i++) {
      grid.push([]);
      for (let j = 0; j < ny; j++) {
        grid[i].push(new Cell(i, j));
      }
    }

    let stack = [];
    let visited = {}; // "{x},{y}"
    let current = grid[0][0];
    const totalCells = nx * ny;

    visited[hash(current)] = true;

    while(Object.keys(visited).length < totalCells) {
      const unvisitedN = getUnvisitedNeighbors(visited, grid, current.x, current.y);
      if (unvisitedN.length) {
        const randomN = unvisitedN[Math.trunc(unvisitedN.length * this.rng())];
        stack.push(current);
        current.addNeighbor(randomN);
        randomN.addNeighbor(current);
        current = randomN;
        visited[hash(current)] = true;
      } else if (stack.length) {
        current = stack.pop();
      }
    }

    grid[nx-1][ny-1].target = true;

    return grid;
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
    if (previous)
      current.updateNeighbor(previous, (1 - LEARNING_RATE) * current.getNeighborWeight(previous) + LEARNING_RATE * (reward + factor * Math.max(...previous.table)));
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
  worldGenerator = new WorldGenerator(wgrand);
  init();
}

function init() {
  const nx = 600 / RESOLUTION;
  const ny = 600 / RESOLUTION;

  grid = worldGenerator.generate(nx, ny);
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
