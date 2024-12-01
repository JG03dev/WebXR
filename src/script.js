import * as THREE from "three";
import { TubePainter } from "three/examples/jsm/misc/TubePainter.js";
import { XRButton } from "three/examples/jsm/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let stylus;
let painter1;
let gamepad1;
let isDrawing = false;
let prevIsDrawing = false;

const material = new THREE.MeshNormalMaterial({
  flatShading: true,
  side: THREE.DoubleSide,
});

const cursor = new THREE.Vector3();

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

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const grid = new THREE.GridHelper(4, 1, 0x111111, 0x111111);
  scene.add(grid);

  scene.add(new THREE.HemisphereLight(0x888877, 0x777788, 3));

  const light = new THREE.DirectionalLight(0xffffff, 1.5);
  light.position.set(0, 4, 0);
  scene.add(light);

  painter1 = new TubePainter();
  painter1.mesh.material = material;
  painter1.setSize(0.1);

  scene.add(painter1.mesh);

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

  // Crear el plano vertical (orientado verticalmente)
  const geometry = new THREE.PlaneGeometry(2, 2);  // Plane con dimensiones 5x5
  const materialPlane = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide }); // Material verde
  const plane = new THREE.Mesh(geometry, materialPlane);

  // Rotar el plano para que sea vertical
  plane.rotation.y = -Math.PI; // -90 grados sobre el eje X
  plane.position.x = 1; // Elevarlo un poco para que esté a la altura de la cámara
  plane.position.z = 15;

// Añadir el plano a la escena
  scene.add(plane);
  
/*
  //Codigo para el canvas en 2D------
  // Agregar un canvas 2D para dibujo
const drawingCanvas = document.createElement("canvas");
drawingCanvas.classList.add("drawing-canvas");
document.body.appendChild(drawingCanvas);

// Configuración inicial del canvas 2D
const drawingCtx = drawingCanvas.getContext("2d");
drawingCanvas.width = window.innerWidth;
drawingCanvas.height = window.innerHeight;

// Variables para dibujar
let isDrawing2D = false;
let lastX = 0;
let lastY = 0;

// Funciones de dibujo
function startDrawing2D(e) {
  isDrawing2D = true;
  const { offsetX, offsetY } = getCanvasCoordinates(e);
  [lastX, lastY] = [offsetX, offsetY];
}

function draw2D(e) {
  if (!isDrawing2D) return;
  const { offsetX, offsetY } = getCanvasCoordinates(e);

  drawingCtx.strokeStyle = "red"; // Color del pincel
  drawingCtx.lineWidth = 5; // Grosor del pincel
  drawingCtx.lineJoin = "round";
  drawingCtx.lineCap = "round";

  drawingCtx.beginPath();
  drawingCtx.moveTo(lastX, lastY);
  drawingCtx.lineTo(offsetX, offsetY);
  drawingCtx.stroke();
  [lastX, lastY] = [offsetX, offsetY];
}

function stopDrawing2D() {
  isDrawing2D = false;
  drawingCtx.beginPath(); // Limpia el path actual
}*/
}

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
  if (gamepad1) {
    prevIsDrawing = isDrawing;
    isDrawing = gamepad1.buttons[5].value > 0;
    // debugGamepad(gamepad1);

    if (isDrawing && !prevIsDrawing) {
      const painter = stylus.userData.painter;
      painter.moveTo(stylus.position);
    }
  }

  handleDrawing(stylus);

  // Render
  renderer.render(scene, camera);
}

function handleDrawing(controller) {
  if (!controller) return;

  const userData = controller.userData;
  const painter = userData.painter;

  if (gamepad1) {
    cursor.set(stylus.position.x, stylus.position.y, stylus.position.z);

    if (userData.isSelecting || isDrawing) {

      painter.lineTo(cursor);
      painter.update();
    }
  }
}

function onControllerConnected(e) {
  if (e.data.profiles.includes("logitech-mx-ink")) {
    stylus = e.target;
    stylus.userData.painter = painter1;
    gamepad1 = e.data.gamepad;
  }
}

function onSelectStart(e) {
  if (e.target !== stylus) return;
  const painter = stylus.userData.painter;
  painter.moveTo(stylus.position);
  this.userData.isSelecting = true;
}

function onSelectEnd() {
  this.userData.isSelecting = false;
}

function debugGamepad(gamepad) {
  gamepad.buttons.forEach((btn, index) => {
    if (btn.pressed) {
      console.log(`BTN ${index} - Pressed: ${btn.pressed} - Touched: ${btn.touched} - Value: ${btn.value}`);
    }

    if (btn.touched) {
      console.log(`BTN ${index} - Pressed: ${btn.pressed} - Touched: ${btn.touched} - Value: ${btn.value}`);
    }
  });
}
