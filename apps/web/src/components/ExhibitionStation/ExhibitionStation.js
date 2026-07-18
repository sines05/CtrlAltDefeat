import * as THREE from 'three';
import { VideoDisplay } from '../VideoDisplay/VideoDisplay.js';

export class ExhibitionStation {
  constructor(stepInfo, videoUrl, x, z, rotationY) {
    this.stepNum = stepInfo.stepNum;
    this.name = stepInfo.name;
    this.nameEn = stepInfo.nameEn;
    this.narration = stepInfo.narration;
    this.narrationEn = stepInfo.narrationEn;

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotationY;

    // Calculate guide stand position in world space based on station orientation
    // Guide stands 2.5m in front of the station and 2.0m to the right (from user's perspective looking at wall)
    const forward = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
    const right = new THREE.Vector3(Math.cos(rotationY), 0, -Math.sin(rotationY));
    
    this.guideStandPos = new THREE.Vector3(x, 0, z)
      .addScaledVector(forward, 2.5)
      .addScaledVector(right, -2.0); // positive Z direction when facing positive X
    
    // Player stands 4.2m directly in front of the screen
    this.playerStandPos = new THREE.Vector3(x, 0, z)
      .addScaledVector(forward, 4.2);
    
    // Center of the video screen in world coordinates
    this.lookPos = new THREE.Vector3(x, 2.2, z);

    // Initialize VideoDisplay
    this.videoDisplay = new VideoDisplay(videoUrl);

    this.buildMeshes();
  }

  buildMeshes() {
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0xc89e6c,
      roughness: 0.6,
      metalness: 0.0
    });

    const darkWoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d4037,
      roughness: 0.5,
      metalness: 0.0
    });

    // Backing panel (large wooden board)
    const backWallGeo = new THREE.BoxGeometry(4.2, 3.2, 0.15);
    const backWall = new THREE.Mesh(backWallGeo, woodMaterial);
    backWall.position.set(0, 2.5, -0.08);
    this.group.add(backWall);

    // Wooden frame dimensions around the video screen
    const frameThickness = 0.15;
    const frameDepth = 0.1;
    const frameWidth = 3.6;
    const frameHeight = 2.0;

    // Top border
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(frameWidth + frameThickness * 2, frameThickness, frameDepth), darkWoodMaterial);
    topFrame.position.set(0, 2.2 + frameHeight / 2 + frameThickness / 2, 0.03);
    this.group.add(topFrame);

    // Bottom border
    const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(frameWidth + frameThickness * 2, frameThickness, frameDepth), darkWoodMaterial);
    bottomFrame.position.set(0, 2.2 - frameHeight / 2 - frameThickness / 2, 0.03);
    this.group.add(bottomFrame);

    // Left border
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, frameHeight, frameDepth), darkWoodMaterial);
    leftFrame.position.set(-frameWidth / 2 - frameThickness / 2, 2.2, 0.03);
    this.group.add(leftFrame);

    // Right border
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, frameHeight, frameDepth), darkWoodMaterial);
    rightFrame.position.set(frameWidth / 2 + frameThickness / 2, 2.2, 0.03);
    this.group.add(rightFrame);

    // Video Screen Mesh
    const videoScreenGeo = new THREE.PlaneGeometry(frameWidth, frameHeight);
    const videoScreen = new THREE.Mesh(videoScreenGeo, new THREE.MeshBasicMaterial({ map: this.videoDisplay.texture }));
    videoScreen.position.set(0, 2.2, 0.02);
    this.group.add(videoScreen);

    // Information Panel (Wooden backing board)
    const infoBoardGeo = new THREE.BoxGeometry(2.0, 0.8, 0.05);
    const infoBoard = new THREE.Mesh(infoBoardGeo, woodMaterial);
    infoBoard.position.set(0, 0.7, 0.05);
    this.group.add(infoBoard);

    // Canvas Texture for Info Text (placeholder details)
    const infoCanvas = document.createElement('canvas');
    infoCanvas.width = 512;
    infoCanvas.height = 200;
    const infoCtx = infoCanvas.getContext('2d');
    
    infoCtx.fillStyle = '#fdfbf7';
    infoCtx.fillRect(0, 0, 512, 200);
    infoCtx.strokeStyle = '#c89e6c';
    infoCtx.lineWidth = 6;
    infoCtx.strokeRect(10, 10, 492, 180);

    infoCtx.textAlign = 'center';
    infoCtx.textBaseline = 'middle';
    
    infoCtx.font = 'bold 24px "Outfit", system-ui, sans-serif';
    infoCtx.fillStyle = '#5d4037';
    infoCtx.fillText(`BƯỚC ${this.stepNum}: ${this.name.toUpperCase()}`, 256, 50);

    infoCtx.font = 'italic 16px "Outfit", system-ui, sans-serif';
    infoCtx.fillStyle = '#8d6e63';
    infoCtx.fillText(`STEP ${this.stepNum}: ${this.nameEn}`, 256, 95);

    infoCtx.font = '13px "Outfit", system-ui, sans-serif';
    infoCtx.fillStyle = '#4e342e';
    const descText = this.narration.substring(0, 55) + "...";
    infoCtx.fillText(descText, 256, 145);

    const infoTexture = new THREE.CanvasTexture(infoCanvas);
    const infoScreenMat = new THREE.MeshBasicMaterial({ map: infoTexture });
    const infoTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.7), infoScreenMat);
    infoTextPlane.position.set(0, 0.7, 0.08);
    this.group.add(infoTextPlane);

    this.resources = {
      woodMaterial,
      darkWoodMaterial,
      infoTexture,
      infoScreenMat,
      videoScreenGeo,
      infoBoardGeo
    };
  }

  update(time) {
    if (this.videoDisplay.isMock) {
      this.videoDisplay.updateMock(time, this.stepNum, this.name);
    }
  }

  dispose() {
    this.videoDisplay.dispose();
    if (this.resources) {
      this.resources.woodMaterial.dispose();
      this.resources.darkWoodMaterial.dispose();
      this.resources.infoTexture.dispose();
      this.resources.infoScreenMat.dispose();
      this.resources.videoScreenGeo.dispose();
      this.resources.infoBoardGeo.dispose();
    }
  }
}
