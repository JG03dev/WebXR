import * as THREE from "three";
import { TubePainter } from "three/examples/jsm/misc/TubePainter.js";
import { XRButton } from "three/examples/jsm/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { AudioHandler } from './audioHandler.js';

let audioHandler;
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
  /*
  // Evento para guardar la imagen
  controller1.addEventListener("selectstart", onCaptureImage);
  */
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
  const geometry = new THREE.PlaneGeometry(1.5, 1);  // Plane con dimensiones 3x2
  const textureLoader = new THREE.TextureLoader();

  const texture = textureLoader.load('textures/Barcos.jpg'); // Ruta de tu imagen
  // Crear el material con la textura (imagen)
  const materialPlane = new THREE.MeshBasicMaterial({ 
      map: texture, 
      side: THREE.DoubleSide // Visible desde ambos lados
  });
  /* comentado para color solido
  const materialPlane = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide }); // Material verde (color solido)
  */
  const plane = new THREE.Mesh(geometry, materialPlane);

  // Rotar el plano para que sea vertical
  plane.rotation.y = -Math.PI; // -90 grados sobre el eje X
  plane.position.y = 1.30;
  plane.position.z = -1;

// Añadir el plano a la escena
  scene.add(plane);

   // Initialize audio handler (just basic setup)
   audioHandler = new AudioHandler();
   audioHandler.initialize().then(success => {
       if (success) {
           // Add the audio icon to the camera
           camera.add(audioHandler.audioIcon);
           
           // Set up event listener for recorded audio
           window.addEventListener('audioRecorded', (event) => {
               const audioBlob = event.detail.audioBlob;
               console.log('Audio ready for processing:', audioBlob);
           });
       }
   });
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

  //if (audioHandler) {
  audioHandler.updateIconAnimation();
  //}

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

    if (gamepad1.buttons[1].pressed) { // Suponiendo que el botón 1 se usa para capturar
      onCaptureImage();
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

// Modify your controller event handler
function setupControllerEvents() {
  // Now the audio context will initialize on first controller interaction
  controller1.addEventListener('selectstart', async () => {
      await audioHandler.startRecording();
  });
  
  controller1.addEventListener('selectend', () => {
      audioHandler.stopRecording();
  });
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (audioHandler) {
      audioHandler.dispose();
  }
});

// Función para capturar la imagen
function onCaptureImage() {
  // Capturar el lienzo como una imagen
  const imageData = renderer.domElement.toDataURL("image/png");

  // Crear un enlace para descargar la imagen
  const link = document.createElement("a");
  link.href = imageData;
  link.download = "captura_vr.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("Imagen capturada y guardada.");
}