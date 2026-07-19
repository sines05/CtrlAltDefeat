import * as THREE from 'three';

export class Plaque {
  constructor(x, z, rotationY) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotationY;

    this.buildMesh();
  }

  buildMesh() {
    // 1. Materials
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x24170c, // Rich aged dark wood
      roughness: 0.85,
      metalness: 0.05
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb58e45, // Aged brass metal
      roughness: 0.35,
      metalness: 0.8
    });

    // 2. Base Pedestal
    const baseGeo = new THREE.BoxGeometry(0.7, 0.12, 0.5);
    const base = new THREE.Mesh(baseGeo, darkWoodMat);
    base.position.y = 0.06;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    // 3. Vertical Support Post
    const postGeo = new THREE.BoxGeometry(0.12, 0.85, 0.12);
    const post = new THREE.Mesh(postGeo, darkWoodMat);
    post.position.set(0, 0.545, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    this.group.add(post);

    // 4. Bracket Connector
    const bracketGeo = new THREE.BoxGeometry(0.35, 0.08, 0.08);
    const bracket = new THREE.Mesh(bracketGeo, brassMat);
    bracket.position.set(0, 0.97, 0.04);
    this.group.add(bracket);

    // 5. Plaque Board (Angled)
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 1.05, 0);
    boardGroup.rotation.x = -Math.PI / 7; // Tilt back 25 degrees

    const boardBackGeo = new THREE.BoxGeometry(0.66, 0.44, 0.05);
    const boardBack = new THREE.Mesh(boardBackGeo, darkWoodMat);
    boardBack.castShadow = true;
    boardBack.receiveShadow = true;
    boardGroup.add(boardBack);

    // 6. Draw text canvas for the front face
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    // Soft parchment cream color
    ctx.fillStyle = '#f6f0e2';
    ctx.fillRect(0, 0, 1024, 768);

    // Elegant borders
    ctx.strokeStyle = '#24170c';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, 984, 728);
    ctx.strokeStyle = '#b58e45';
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, 952, 696);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#24170c';

    // Title
    ctx.font = 'bold 36px "Georgia", serif';
    ctx.fillText('GIẤY DÓ – VIETNAMESE TRADITIONAL PAPER', 512, 120);

    // Divider line
    ctx.strokeStyle = '#b58e45';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(350, 165);
    ctx.lineTo(674, 165);
    ctx.stroke();

    // Summary Text
    ctx.font = '28px "Georgia", serif';
    const text = 'Giấy dó là chất liệu lưu giữ hồn cốt văn hóa Việt qua nhiều thế kỷ. Được chế tác từ vỏ cây dó tự nhiên, loại giấy này nổi tiếng với độ bền bỉ hàng trăm năm, kết cấu xốp nhẹ, thấm mực hoàn hảo. Giấy dó là nền tảng cho dòng tranh dân gian Đông Hồ, Hàng Trống, lưu giữ kinh sách cổ và sắc phong triều đại.';
    
    const words = text.split(' ');
    let line = '';
    let y = 250;
    const maxWidth = 840;
    const lineHeight = 48;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, 512, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 512, y);

    // Cultural footer
    ctx.fillStyle = '#8c6b3e';
    ctx.font = 'italic 24px "Georgia", serif';
    ctx.fillText('• Triển lãm Di sản Văn hóa Việt Nam •', 512, 660);

    const textTex = new THREE.CanvasTexture(canvas);
    textTex.colorSpace = THREE.SRGBColorSpace;

    // Brass Plate Front
    const plateGeo = new THREE.PlaneGeometry(0.62, 0.40);
    const plateMat = new THREE.MeshStandardMaterial({
      map: textTex,
      roughness: 0.4,
      metalness: 0.1
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.z = 0.026; // Prevent z-fighting
    boardGroup.add(plate);

    this.group.add(boardGroup);
  }

  dispose() {
    this.group.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
