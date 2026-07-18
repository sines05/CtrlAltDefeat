import * as THREE from 'three';

export class VideoDisplay {
  constructor(videoUrl) {
    this.videoUrl = videoUrl;
    this.video = null;
    this.texture = null;
    this.isLoaded = false;
    this.isMock = !videoUrl;

    if (this.isMock) {
      this.initMockCanvas();
    } else {
      this.initVideoElement();
    }
  }

  initVideoElement() {
    this.video = document.createElement('video');
    this.video.loop = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.crossOrigin = 'anonymous';
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.preload = 'none';

    this.texture = new THREE.VideoTexture(this.video);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    
    // Crop 15% from top and 15% from bottom (show middle 70%)
    this.texture.repeat.set(1, 0.7);
    this.texture.offset.set(0, 0.15);
  }

  initMockCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 360;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    
    // Crop 15% from top and 15% from bottom (show middle 70%)
    this.texture.repeat.set(1, 0.7);
    this.texture.offset.set(0, 0.15);
  }

  load() {
    if (this.isMock || this.isLoaded) return;
    console.log(`[VideoDisplay] Lazy loading video source: ${this.videoUrl}`);
    this.video.src = this.videoUrl;
    this.video.load();
    this.isLoaded = true;
  }

  play() {
    if (this.isMock) return;
    if (!this.isLoaded) {
      this.load();
    }
    if (this.video.paused) {
      this.video.play().catch(err => {
        console.warn(`[VideoDisplay] Play failed: ${err.message}`);
      });
    }
  }

  pause() {
    if (this.isMock) return;
    if (this.isLoaded && !this.video.paused) {
      this.video.pause();
    }
  }

  unload() {
    if (this.isMock || !this.isLoaded) return;
    console.log(`[VideoDisplay] Unloading video: ${this.videoUrl}`);
    this.video.pause();
    this.video.src = "";
    try {
      this.video.load();
    } catch (e) {}
    this.isLoaded = false;
  }

  updateMock(time, stepNum, stepName) {
    if (!this.isMock) return;
    const ctx = this.ctx;
    
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(0, 0, 640, 360);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.lineWidth = 2;
    for (let l = 0; l < 10; l++) {
      const yPos = (Math.sin(time * 0.8 + l) * 60 + 180 + l * 15) % 360;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.bezierCurveTo(200, yPos + Math.sin(time + l) * 30, 440, yPos - Math.sin(time + l) * 30, 640, yPos);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(320, 180, 80 + Math.sin(time * 1.5) * 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(320, 180, 100 - Math.cos(time * 1.2) * 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.font = 'bold 36px "Outfit", system-ui, sans-serif';
    ctx.fillStyle = '#ffb74d';
    ctx.fillText(`BƯỚC ${stepNum}`, 320, 155);

    ctx.font = '500 24px "Outfit", system-ui, sans-serif';
    ctx.fillStyle = '#ffe0b2';
    ctx.fillText(stepName || '', 320, 205);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(20, 335, 600, 6);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(20, 335, ((time * 30) % 600), 6);

    this.texture.needsUpdate = true;
  }

  dispose() {
    this.unload();
    if (this.texture) {
      this.texture.dispose();
    }
  }
}
