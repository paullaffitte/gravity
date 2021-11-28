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
let closestToMouse;
let massiveObjectsComputed = 0;
let iterationsPerStep = 0;
const massBase = 50;
const settings = {};

function init() {
  initInputs();
  const canvas = document.getElementById("gravity");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const stage = new createjs.Stage("gravity");

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
    follow: () => followTarget = closestToMouse.object,
    unfollow: () => followTarget = null,
  });
  keyboardControls.mapping = [
    { control: 'left', keys: [ 'A' ] },
    { control: 'right', keys: [ 'D' ] },
    { control: 'up', keys: [ 'W' ] },
    { control: 'down', keys: [ 'S' ] },
    { control: 'zoomIn', keys: [ 'E' ] },
    { control: 'zoomOut', keys: [ 'Q' ] },
    { control: 'repeat', keys: [ 'R' ], onPress: true },
    { control: 'follow', keys: [ 'F' ], onPress: true },
    { control: 'unfollow', keys: [ 'U' ], onPress: true },
  ];

  handleCreateObject(stage);

  document.addEventListener('wheel', e => {
    keyboardControls.controls.zoomIn(e.deltaY / 1000);
  });

  document.getElementById("reset").addEventListener("click", () => {
   resetStage(stage);
  });

  const informations = {
    objects: document.getElementById("objects"),
    zoomLevel: document.getElementById("zoomLevel"),
    cameraSpeed: document.getElementById("cameraSpeed"),
    massiveObjectsComputed: document.getElementById("massiveObjectsComputed"),
    iterationsPerStep: document.getElementById("iterationsPerStep"),
    followedObjectRadius: document.getElementById("followedObjectRadius"),
    followedObjectMass: document.getElementById("followedObjectMass"),
  };

  createjs.Ticker.on("tick", e => {
    const delta = e.delta / 1000 * settings.simulationSpeed;
    const optimalIterationsPerStep = (stage.objects.length * (stage.objects.length - 1)) / 2;
    update(e, stage, delta);
    keyboardControls.update(delta);
    informations.objects.innerHTML = stage.objects.length;
    informations.massiveObjectsComputed.innerHTML = massiveObjectsComputed + ' (' + (massiveObjectsComputed / stage.objects.length * 100).toFixed(0) + '%)';
    informations.iterationsPerStep.innerHTML = iterationsPerStep + ' (' + Math.round(iterationsPerStep / optimalIterationsPerStep * 100) + '%)';
    informations.zoomLevel.innerHTML = Math.abs(stage.scale * 100).toFixed(3);
    informations.cameraSpeed.innerHTML = followTarget ? (followTarget.force.norm() / followTarget.mass).toFixed(2) : 0;
    informations.followedObjectRadius.innerHTML = followTarget ? followTarget.radius.toFixed(2) : '-';
    informations.followedObjectMass.innerHTML = followTarget ? followTarget.mass.toFixed(2) : '-';
  });
  createjs.Ticker.framerate = 60;

  resetStage(stage);
}

function resetStage(stage) {
  followTarget = null;
  stage.removeAllChildren();
  stage.regX = window.innerWidth / 2;
  stage.regY = window.innerHeight / 2;
  stage.x = stage.regX;
  stage.y = stage.regY;
  stage.scale = 1;
  stage.objects = [];

  for (let i = 0; i < settings.initialObjects; i++) {
    const area = settings.initialObjects / settings.initialDensity * 200 * 200; // one object per 200px^2
    const maxDistanceFromCenter = Math.sqrt(area / Math.PI);
    const randAngle = Math.random();
    const randDistance = settings.uniformDistribution ? Math.sqrt(Math.random()) : Math.random();
    addObject(stage,
      Math.max(0.3, Math.random()) * 2,
      asVector(
        Math.cos(randAngle * Math.PI * 2) * maxDistanceFromCenter * randDistance + window.innerWidth / 2,
        Math.sin(randAngle * Math.PI * 2) * maxDistanceFromCenter * randDistance + window.innerHeight / 2
      ),
      asVector(
        -Math.sin(randAngle * Math.PI * 2) * settings.initialRadialSpeed * (settings.uniformRadialSpeed ? randDistance : 1),
        Math.cos(randAngle * Math.PI * 2) * settings.initialRadialSpeed * (settings.uniformRadialSpeed ? randDistance : 1),
        )
    );
  }

  const closestIndicator = new createjs.Shape();
  stage.addChild(closestIndicator);
  stage.closestIndicator = closestIndicator;
}

function initInputs() {
  const inputs = document.getElementById("inputs");
  document.getElementById('toggle-inputs').addEventListener('click', e => {
    if (inputs.style.height) {
      inputs.style.height = null;
      e.target.innerHTML = '▲';
    } else {
      inputs.style.height = '2em';
      e.target.innerHTML = '▼';
    }
  });

  inputs.addEventListener('input', e => {
    if (e.target.type == 'checkbox') {
      settings[e.target.name] = e.target.checked;
    } else {
      settings[e.target.name] = parseFloat(e.target.value);
    }
  });

  inputs.querySelectorAll('input').forEach(input => {
    input.dispatchEvent(new Event('input', {
      bubbles: true,
      cancelable: true,
    }));
  });
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

  stage.on("stagemousedown", function(evt) {
    position = { x: evt.stageX, y: evt.stageY };
  });

  stage.on("stagemouseup", function(evt) {
    let force = onVector(toVector(position, { x: evt.stageX, y: evt.stageY }), v => v / stage.scale);
    const realPosition = stage.globalToLocal(position.x, position.y);
    addObject(stage, settings.radius, realPosition, force);
    position = null;
  });
}

function addObject(stage, radius, position, force) {
  const circle = new createjs.Shape();

  setLastObject(radius, force);

  if (followTarget) {
    force = toVector(force, onVector(followTarget.force, v => v / followTarget.mass), add);
  }

  circle.graphics
    .beginFill("White")
    .drawCircle(0, 0, radius);

  circle.x = position.x;
  circle.y = position.y;
  circle.radius = radius;
  circle.mass = Math.PI * Math.pow(radius, 2) * massBase;
  circle.force = onVector(force, v => v * circle.mass);

  stage.addChild(circle);
  stage.objects.push(circle);
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

function getClosestToMouse(stage) {
  const { x, y } = stage.globalToLocal(stage.mouseX, stage.mouseY);
  const closer = {};

  if (stage.objects.length == 0)
    return;

  stage.objects.forEach(object => {
    const distance = asVector(x - object.x, y - object.y).norm();

    if (!closer.object || distance < closer.distance) {
      closer.object = object;
      closer.distance = distance;
    }
  });

  return closer;
}

function update(event, stage, delta) {
  const massSortedObjects = stage.objects.sort((a, b) => b.mass - a.mass)

  for (let i = 0; i < stage.objects.length; i++) {
    const a = stage.objects[i];
    a.x += delta * a.force.x / a.mass;
    a.y += delta * a.force.y / a.mass;
  }

  // Only apply forces and collisions from biggest objects to all other objects
  massiveObjectsComputed = Math.pow(settings.resolution, 2) / stage.objects.length
  massiveObjectsComputed = Math.min(Math.ceil(massiveObjectsComputed), stage.objects.length);
  iterationsPerStep = 0;
  for (let i = 0; i < massiveObjectsComputed; i++) {
    const a = massSortedObjects[i];
    for (let j = i + 1; j < stage.objects.length; j++) {
      const b = stage.objects[j];
      iterationsPerStep++;
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

  closestToMouse = getClosestToMouse(stage);
  stage.closestIndicator.graphics.clear();
  if (settings.showClosestObject) {
    stage.closestIndicator.graphics
      .setStrokeStyle(1 / stage.scale)
      .beginStroke("White")
      .drawCircle(closestToMouse.object.x, closestToMouse.object.y, closestToMouse.object.radius + 20 / stage.scale);
  }

  stage.objects = stage.objects.filter(object => !object.toDelete);
  stage.children = stage.children.filter(child => !child.toDelete);

  if (followTarget) {
    stage.regX = followTarget.x;
    stage.regY = followTarget.y;
  }

  stage.update(event);
}
