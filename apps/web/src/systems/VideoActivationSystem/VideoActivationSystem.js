import * as THREE from 'three';

export class VideoActivationSystem {
  constructor(stations) {
    this.stations = stations;
    
    // Activation distances in meters
    this.ACTIVE_DISTANCE = 5.5;
    this.BUFFER_DISTANCE = 12.0;
    this.CULL_DISTANCE = 20.0;
  }

  update(time, playerPos, guidePos) {
    if (!playerPos) return;

    this.stations.forEach(station => {
      const distToPlayer = station.group.position.distanceTo(playerPos);
      const distToGuide = guidePos ? station.group.position.distanceTo(guidePos) : Infinity;
      const dist = Math.min(distToPlayer, distToGuide);

      // 1. Render Culling (Toggle mesh visibility)
      if (dist >= this.CULL_DISTANCE) {
        station.group.visible = false;
        station.videoDisplay.unload();
        return;
      }
      station.group.visible = true;

      // 2. Playback and Loading State Machine (load on activation, then toggle play/pause)
      if (dist < this.ACTIVE_DISTANCE) {
        station.videoDisplay.play();
      } else {
        station.videoDisplay.pause();
      }

      // 3. Update mock screen animation if applicable
      station.update(time);
    });
  }

  dispose() {
    this.stations.forEach(station => {
      if (station.dispose) {
        station.dispose();
      }
    });
  }
}
