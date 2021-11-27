class KeyboardControls {
  constructor(controls) {
    this.controls = controls;
    this.keyboardEvents = {};
    this.activeControls = {};

    document.addEventListener('keydown', e => {
      const { handler, onPress, control } = this.getKeyboardEvent(e.key);

      if (!handler)
        return;

      if (onPress) {
        handler();
      } else {
        this.activeControls[control] = handler;
      }
    });

    document.addEventListener('keyup', e => {
      const { handler, onPress, control } = this.getKeyboardEvent(e.key);

      if (handler && !onPress) {
        delete this.activeControls[control];
      }
    });
  }

  set mapping(mapping) {
    this.keyboardEvents = mapping
      .reduce((acc, { control, keys, onPress }) => {
        keys.forEach(key => acc[key.toLowerCase()] = {
          handler: this.controls[control],
          control,
          onPress
        });
        return acc;
      }, {});
  }

  update(delta) {
    Object.values(this.activeControls)
      .forEach(control => control(delta));
  }

  getKeyboardEvent(key) {
    return this.keyboardEvents[key.toLowerCase()] || {};
  }
}

let lastObject = {};
const setLastObject = (radius, force) => lastObject = { radius, force };
let followTarget;
const massBase = 50;
const initialObjects = 1000;
const initialDensity = 1;
const topBiggestToCompute = 500;
window.simulationSpeed = 1;

function init() {
  const canvas = document.getElementById("gravity");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const stage = new createjs.Stage("gravity");
  stage.regX = window.innerWidth / 2;
  stage.regY = window.innerHeight / 2;
  stage.x = stage.regX;
  stage.y = stage.regY;

  const speed = delta => 300 * delta / stage.scale;
  const zoom = delta => 1 + 1 * delta;
  const keyboardControls = new KeyboardControls({
    left: delta => stage.regX -= speed(delta),
    right: delta => stage.regX += speed(delta),
    up: delta => stage.regY -= speed(delta),
    down: delta => stage.regY += speed(delta),
    zoomIn: delta => stage.scale *= zoom(delta),
    zoomOut: delta => stage.scale *= 1 / zoom(delta),
    repeat: () => addObject(stage, lastObject.radius, stage.globalToLocal(stage.mouseX, stage.mouseY), lastObject.force),
    follow: () => {
      const { x, y } = stage.globalToLocal(stage.mouseX, stage.mouseY);
      const closer = {};

      if (stage.children.length == 0)
        return;

      stage.children.forEach(child => {
        const distance = asVector(x - child.x, y - child.y).norm();

        if (!closer.child || distance < closer.distance) {
          closer.child = child;
          closer.distance = distance;
        }
      });

      followTarget = closer.child;
    },
    unfollow: () => followTarget = null,
  });
  keyboardControls.mapping = [
    { control: 'left', keys: [ 'ArrowLeft', 'A' ] },
    { control: 'right', keys: [ 'ArrowRight', 'D' ] },
    { control: 'up', keys: [ 'ArrowUp', 'W' ] },
    { control: 'down', keys: [ 'ArrowDown', 'S' ] },
    { control: 'zoomIn', keys: [ 'ArrowDown', 'E' ] },
    { control: 'zoomOut', keys: [ 'ArrowDown', 'Q' ] },
    { control: 'repeat', keys: [ 'R' ], onPress: true },
    { control: 'follow', keys: [ 'F' ], onPress: true },
    { control: 'unfollow', keys: [ 'U' ], onPress: true },
  ];

  handleCreateObject(stage);

  document.addEventListener('wheel', e => {
    keyboardControls.controls.zoomIn(e.deltaY / 1000);
  });

  createjs.Ticker.on("tick", e => {
    const delta = e.delta / 1000 * window.simulationSpeed
    update(e, stage, delta);
    keyboardControls.update(delta);
  });
  createjs.Ticker.framerate = 60;

  for (let i = 0; i < initialObjects; i++) {
    const area = initialObjects / initialDensity * 200 * 200; // one object per 200px^2
    const maxDistanceFromCenter = Math.sqrt(area / Math.PI);
    const randAngle = Math.random();
    const randDistance = Math.random();
    addObject(stage,
      Math.max(0.3, Math.random()) * 2,
      asVector(
        Math.cos(randAngle * Math.PI * 2) * maxDistanceFromCenter * randDistance + window.innerWidth / 2,
        Math.sin(randAngle * Math.PI * 2) * maxDistanceFromCenter * randDistance + window.innerHeight / 2
      ),
      asVector(0, 0)
    );
  }
}

const sub = (a, b) => a - b;
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;
const divide = (a, b) => a / b;

const asVector = (x, y) => ({ x, y, norm: () => Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) });
const toVector = (src, dest, op=sub) => asVector(op(dest.x, src.x), op(dest.y, src.y));
const onVector = (vec, op) => asVector(op(vec.x), op(vec.y));

function handleCreateObject(stage) {
  let position = null;
  let force = null;

  stage.on("stagemousedown", function(evt) {
    position = { x: evt.stageX, y: evt.stageY };
  });

  stage.on("stagemouseup", function(evt) {
    force = onVector(toVector(position, { x: evt.stageX, y: evt.stageY }), v => v / stage.scale);
    const realPosition = stage.globalToLocal(position.x, position.y);
    addObject(stage, 1, realPosition, force);
    position = null;
    force = null;
  });
}

function addObject(stage, radius, position, force) {
  const circle = new createjs.Shape();

  setLastObject(radius, force);

  circle.graphics
    .beginFill("White")
    .drawCircle(0, 0, radius);

  circle.x = position.x;
  circle.y = position.y;
  circle.radius = radius;
  circle.mass = Math.PI * Math.pow(radius, 2) * massBase;
  circle.force = onVector(force, v => v * circle.mass);

  stage.addChild(circle);
}

function updateSpeed(a, b, distanceVector) {
  const distance = distanceVector._norm;

  if (distance == 0)
    return;

  const gForce = a.mass * b.mass / Math.pow(distance, 2);

  const direction = onVector(distanceVector, v => v / distance);
  const force = onVector(direction, v => v * gForce)
  a.force = toVector(a.force, force, add);
  b.force = toVector(force, b.force, sub);
}

function hasCollision(a, b, distanceVector) {
  const distance = distanceVector._norm;
  return distance - (a.radius + b.radius) <= 0;
}

function mergeObjects(a, b) {
  b.toDelete = true;
  a.force = toVector(a.force, b.force, add);
  a.x = (a.x * a.mass + b.x * b.mass) / (a.mass + b.mass);
  a.y = (a.y * a.mass + b.y * b.mass) / (a.mass + b.mass);
  a.mass += b.mass;
  a.radius = Math.sqrt(a.mass / Math.PI / massBase);
  a.graphics.command.radius = a.radius;

  if (followTarget && b.id == followTarget.id)
    followTarget = a;
}

function update(event, stage, delta) {
  const massSortedChildren = stage.children.sort((a, b) => b.mass - a.mass)

  for (let i = 0; i < stage.children.length; i++) {
    const a = stage.children[i];
    a.x += delta * a.force.x / a.mass;
    a.y += delta * a.force.y / a.mass;
  }
  // Only apply forces and collisions from biggest objects to all other objects
  for (let i = 0; i < Math.min(topBiggestToCompute, massSortedChildren.length); i++) {
    const a = stage.children[i];
    for (let j = i + 1; j < stage.children.length; j++) {
      const b = stage.children[j];
      if (b.toDelete)
        continue;
      const distanceVector = toVector(asVector(a.x, a.y), asVector(b.x, b.y));
      distanceVector._norm = distanceVector.norm();
      updateSpeed(a, b, distanceVector);
      if (hasCollision(a, b, distanceVector)) {
        mergeObjects(a, b)
      }
    };
  };

  stage.children = stage.children.filter(child => !child.toDelete);

  if (followTarget) {
    stage.regX = followTarget.x;
    stage.regY = followTarget.y;
  }

  stage.update(event);
}
