import * as THREE from "three";
import { XRButton } from "three/examples/jsm/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { AudioHandler } from './audioHandler.js';

let audioHandler;
let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let plane, baseTexture, drawingTexture;
let isDrawing = false;
let gamepad1;
let stylus;
let lastX, lastY;

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

init();

function init() {
  const canvas = document.querySelector("canvas.webgl");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 50);
  camera.position.set(0, 1.6, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setPixelRatio(window.devicePixelRatio, 2);
  renderer.setSize(sizes.width, sizes.height);
  renderer.setAnimationLoop(animate);
  renderer.xr.enabled = true;
  document.body.appendChild(XRButton.createButton(renderer, { optionalFeatures: ["unbounded"] }));

  const controllerModelFactory = new XRControllerModelFactory();

  controller1 = renderer.xr.getController(0);
  controller1.addEventListener("connected", onControllerConnected);
  controller1.addEventListener("selectstart", onSelectStart);
  controller1.addEventListener("selectend", onSelectEnd);
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
  scene.add(controllerGrip1);
  scene.add(controller1);

  controller2 = renderer.xr.getController(1);
  controller2.addEventListener("connected", onControllerConnected);
  controller2.addEventListener("selectstart", onSelectStart);
  controller2.addEventListener("selectend", onSelectEnd);
  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
  scene.add(controllerGrip2);
  scene.add(controller2);

  // Create a canvas for drawing
  const drawingCanvas = document.createElement('canvas');
  drawingCanvas.width = 1024;  // Matches texture size
  drawingCanvas.height = 1024;
  const drawingContext = drawingCanvas.getContext('2d');
  
  // Load base texture
  const textureLoader = new THREE.TextureLoader();
  baseTexture = textureLoader.load('textures/Barcos.jpg', (texture) => {
    // Once texture is loaded, draw its content to the canvas
    drawingContext.drawImage(texture.image, 0, 0, drawingCanvas.width, drawingCanvas.height);
    
    // Create drawing texture
    drawingTexture = new THREE.CanvasTexture(drawingCanvas);
    drawingTexture.minFilter = THREE.LinearFilter;

    // Create the plane with combined texture
    const geometry = new THREE.PlaneGeometry(3, 2);
    const materialPlane = new THREE.MeshBasicMaterial({ 
      map: drawingTexture,
      side: THREE.DoubleSide
    });

    plane = new THREE.Mesh(geometry, materialPlane);
    plane.rotation.y = -Math.PI;
    plane.position.y = 1.5;
    plane.position.z = -1;

    // Add a helper to visualize the plane
    const planeHelper = new THREE.AxesHelper(1);
    plane.add(planeHelper);

    scene.add(plane);
  });

  // Initialize audio handler
  audioHandler = new AudioHandler();
  audioHandler.initialize().then(success => {
    if (success) {
      camera.add(audioHandler.audioIcon);
    }
  });
}

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
  if (gamepad1 && stylus) {
    isDrawing = gamepad1.buttons[5].value > 0;
    
    if (isDrawing) {
      // Create a raycaster to check if the controller is touching the plane
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      
      const intersects = raycaster.intersectObject(plane);
      
      if (intersects.length > 0) {
        // Get the intersection point in the plane's local space
        const localPoint = plane.worldToLocal(intersects[0].point.clone());
        
        // Map local coordinates to texture coordinates
        const textureX = (localPoint.x + 1.5) / 3 * 1024;
        const textureY = (1 - (localPoint.y + 1) / 2) * 1024;
        
        // Draw on the texture
        drawOnTexture(textureX, textureY);
        
        // Optional: log for debugging
        console.log('Drawing at:', textureX, textureY);
      }
    }
  }

  // Update drawing texture
  if (drawingTexture) {
    drawingTexture.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

function drawOnTexture(x, y) {
  if (!drawingTexture) return;

  const canvas = drawingTexture.image;
  const ctx = canvas.getContext('2d');

  // Drawing settings
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';  // Semi-transparent red
  ctx.lineWidth = 10;  // Brush size
  ctx.lineCap = 'round';

  // Draw line if we have a previous position
  if (lastX !== undefined && lastY !== undefined) {
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // Store current position
  lastX = x;
  lastY = y;
}

function onControllerConnected(e) {
  if (e.data.profiles.includes("logitech-mx-ink")) {
    stylus = e.target;
    gamepad1 = e.data.gamepad;
  }
}

function onSelectStart(e) {
  if (e.target !== stylus) return;
  isDrawing = true;
  // Reset last position
  lastX = undefined;
  lastY = undefined;
  
  console.log('Select start - trying to draw');
}

function onSelectEnd() {
  isDrawing = false;
  // Reset last position
  lastX = undefined;
  lastY = undefined;
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (audioHandler) {
    audioHandler.dispose();
  }
});