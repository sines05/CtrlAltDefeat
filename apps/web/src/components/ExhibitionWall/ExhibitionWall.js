import { ExhibitionStation } from '../ExhibitionStation/ExhibitionStation.js';

export function buildStationZCoordinates(numStations) {
  if (numStations <= 0) {
    return [];
  }

  if (numStations === 1) {
    return [0];
  }

  if (numStations === 10) {
    return [-24, -18, -12, -6, 0, 6, 12, 18, 24, 30];
  }

  const zStart = -28;
  const zEnd = 30;
  const spacing = (zEnd - zStart) / (numStations - 1);

  return Array.from({ length: numStations }, (_, index) => zStart + index * spacing);
}

export function createExhibitionWall(scene, stationViewModels = []) {
  const stations = [];
  const stationModels = Array.isArray(stationViewModels) ? stationViewModels : [];

  const leftWallX = -10.8;
  const rotationY = Math.PI / 2;
  const zCoordinates = buildStationZCoordinates(stationModels.length);

  for (let index = 0; index < stationModels.length; index += 1) {
    const stationViewModel = stationModels[index];
    const station = new ExhibitionStation(stationViewModel, leftWallX, zCoordinates[index], rotationY);
    scene.add(station.group);
    stations.push(station);
  }

  return stations;
}
