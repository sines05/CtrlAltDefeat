import * as THREE from 'three';
import { createMuseumCorridor, updateCeilingFans } from '../components/MuseumCorridor.js';
import { createRightSideExhibits } from '../components/RightSideExhibits.js';
import { createExhibitionWall } from '../components/ExhibitionWall/ExhibitionWall.js';

export class App {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    this.camera.position.set(0, 2.0, 28);
    this.camera.lookAt(0, 1.6, 0);

    this.isLocked = false;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.moveDir = { forward: 0, right: 0 };
    this.moveSpeed = 6;

    this.keys = {};
    this.stations = [];
    this.exhibits = [];

    this.buildScene();
    this.setupControls();
    this.setupPointerLock();
  }

  buildScene() {
    createMuseumCorridor(this.scene);
    this.exhibits = createRightSideExhibits(this.scene);
    this.stations = createExhibitionWall(this.scene);

    const hemisphereLight = new THREE.HemisphereLight(0xffeedd, 0x443322, 0.6);
    this.scene.add(hemisphereLight);

    const dirLight = new THREE.DirectionalLight(0xffe6cc, 1.0);
    dirLight.position.set(5, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);
  }

  setupControls() {
    document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  setupPointerLock() {
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.isLocked) {
        this.renderer.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.renderer.domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= e.movementX * 0.002;
      this.euler.x -= e.movementY * 0.002;
      this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  start() {
    this.resize();
    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    this.moveDir.forward = 0;
    this.moveDir.right = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) this.moveDir.forward = 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) this.moveDir.forward = -1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.moveDir.right = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) this.moveDir.right = 1;

    if (this.moveDir.forward !== 0 || this.moveDir.right !== 0) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      right.y = 0;
      right.normalize();

      const move = new THREE.Vector3()
        .addScaledVector(forward, this.moveDir.forward)
        .addScaledVector(right, this.moveDir.right)
        .normalize()
        .multiplyScalar(this.moveSpeed * delta);

      this.camera.position.add(move);
    }

    updateCeilingFans(delta);

    const time = this.clock.elapsedTime;
    for (const station of this.stations) {
      station.update(time);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
