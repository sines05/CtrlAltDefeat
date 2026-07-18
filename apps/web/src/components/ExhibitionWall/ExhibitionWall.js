import * as THREE from 'three';
import { ExhibitionStation } from '../ExhibitionStation/ExhibitionStation.js';

const PAPERMAKING_STEPS = [
  {
    stepNum: 1,
    name: "Nấu vỏ cây Dó",
    nameEn: "Cooking the Dó Bark",
    narration: "Bước 1: Vỏ cây Dó khô sau khi ngâm nước sẽ được đem nấu chín nhừ cùng vôi bột từ 12 đến 18 tiếng.",
    narrationEn: "Step 1: The Dó bark is cooked with lime powder for 12 to 18 hours until soft."
  },
  {
    stepNum: 2,
    name: "Làm bìa vỏ Dó",
    nameEn: "Making Cover Sheet",
    narration: "Bước 2: Vỏ lụa chín vớt ra được ngâm rửa, lọc sạch chất nhựa và giã sơ để làm thành tấm bìa lọc thô.",
    narrationEn: "Step 2: Cooked bark is washed, cleaned of sap, and lightly pounded to make cover sheets."
  },
  {
    stepNum: 3,
    name: "Giã bột Dó",
    nameEn: "Pounding the Pulp",
    narration: "Bước 3: Cho sợi vỏ Dó vào cối đá và giã đều tay cho đến khi các thớ sợi tơi nhuyễn thành bột giấy mịn.",
    narrationEn: "Step 3: Pounding the Dó fibers in a stone mortar until they disintegrate into fine pulp."
  },
  {
    stepNum: 4,
    name: "Đập lề và bào gỗ",
    nameEn: "Trimming & Wood Shaving",
    narration: "Bước 4: Công đoạn đập lề giúp thợ xơ phẳng mép giấy và chuẩn bị khuôn tre phẳng phiu cho bể seo.",
    narrationEn: "Step 4: Trimming edges and prepping wooden elements ensure a smooth sheet layout."
  },
  {
    stepNum: 5,
    name: "Đãi bìa xơ",
    nameEn: "Sifting the Pulp",
    narration: "Bước 5: Bột giấy được đãi trong nước sạch để loại bỏ nốt các mảnh vỏ cứng và tạp chất thô còn sót.",
    narrationEn: "Step 5: Rinsing and sifting the pulp in water to remove any remaining dark bark fragments."
  },
  {
    stepNum: 6,
    name: "Pha keo tàu",
    nameEn: "Mixing with Glue",
    narration: "Bước 6: Pha nhựa cây mò (keo tàu) vào bể bột giúp kết dính các thớ sợi và giúp giấy không bị nhòe mực.",
    narrationEn: "Step 6: Mixing natural glue into the pulp vat to bind fibers and ensure proper ink absorption."
  },
  {
    stepNum: 7,
    name: "Seo giấy Dó",
    nameEn: "Scooping the Sheets",
    narration: "Bước 7: Người thợ chao liềm seo vớt bột giấy và lắc nhẹ đều tay để dàn thớ sợi thành một tờ giấy mỏng.",
    narrationEn: "Step 7: The artisan scoops the screen into the vat and shakes it to lay fibers into a thin sheet."
  },
  {
    stepNum: 8,
    name: "Ép giấy thoát nước",
    nameEn: "Pressing the Paper",
    narration: "Bước 8: Xếp các tờ giấy ướt chồng lên nhau thành thớt giấy lớn rồi ép thủy lực để ép kiệt nước.",
    narrationEn: "Step 8: Stacking wet sheets and pressing them under heavy pressure to squeeze out excess water."
  },
  {
    stepNum: 9,
    name: "Cán phẳng giấy",
    nameEn: "Rolling & Flattening",
    narration: "Bước 9: Tấm giấy ép được cán phẳng bề mặt để các sợi liên kết chặt chẽ và phẳng phiu trước khi sấy.",
    narrationEn: "Step 9: Rolling the sheets to compact the fibers and flatten the surface for drying."
  },
  {
    stepNum: 10,
    name: "Lột giấy sấy khô",
    nameEn: "Peeling and Separating",
    narration: "Bước 10: Từng tờ giấy sau khi sấy khô sẽ được lột cẩn thận ra khỏi vách sấy nóng và xếp thành tệp.",
    narrationEn: "Step 10: Dried sheets are carefully peeled off from the heated wall and stacked into bundles."
  }
];

export function createExhibitionWall(scene) {
  const stations = [];

  let videoUrls = [];
  try {
    const videoModules = import.meta.glob('/making_step/*.mp4', { eager: true });
    videoUrls = Object.values(videoModules).map(mod => mod.default || mod);
  } catch (err) {
    console.warn("Vite glob import failed or empty. Falling back to canvas mock screens.", err);
  }

  const detectedVideos = [];
  videoUrls.forEach(url => {
    const match = url.match(/Buoc(\d+)/i);
    if (match) {
      const stepNum = parseInt(match[1], 10);
      detectedVideos.push({ stepNum, url });
    }
  });

  detectedVideos.sort((a, b) => a.stepNum - b.stepNum);

  const maxStepNum = Math.max(10, detectedVideos.reduce((max, vid) => Math.max(max, vid.stepNum), 0));
  
  const finalSteps = [];
  for (let s = 1; s <= maxStepNum; s++) {
    const videoMatch = detectedVideos.find(v => v.stepNum === s);
    const videoUrl = videoMatch ? videoMatch.url : null;

    let stepInfo = PAPERMAKING_STEPS.find(step => step.stepNum === s);
    if (!stepInfo) {
      stepInfo = {
        stepNum: s,
        name: `Bước Bổ Sung ${s}`,
        nameEn: `Additional Step ${s}`,
        narration: `Bước ${s}: Đây là bước bổ sung được phát hiện tự động trong quy trình sản xuất.`,
        narrationEn: `Step ${s}: This is an additional production step detected automatically.`
      };
    }

    finalSteps.push({ stepInfo, videoUrl });
  }

  const numStations = finalSteps.length;
  console.log(`[ExhibitionWall] Generating ${numStations} exhibition stations dynamically...`);

  const leftWallX = -10.8;
  const rotationY = Math.PI / 2;

  let zCoords = [];
  if (numStations === 10) {
    zCoords = [-24, -18, -12, -6, 0, 6, 12, 18, 24, 30];
  } else if (numStations > 1) {
    const zStart = -28;
    const zEnd = 30;
    const spacing = (zEnd - zStart) / (numStations - 1);
    for (let i = 0; i < numStations; i++) {
      zCoords.push(zStart + i * spacing);
    }
  } else {
    zCoords = [0];
  }

  for (let i = 0; i < numStations; i++) {
    const { stepInfo, videoUrl } = finalSteps[i];
    const z = zCoords[i];

    const station = new ExhibitionStation(stepInfo, videoUrl, leftWallX, z, rotationY);
    scene.add(station.group);
    stations.push(station);

    console.log(`[ExhibitionWall] Station ${stepInfo.stepNum} ("${stepInfo.name}") created at Z = ${z.toFixed(2)}`);
  }

  return stations;
}
