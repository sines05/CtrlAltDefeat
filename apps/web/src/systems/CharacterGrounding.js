import * as THREE from 'three';

export class CharacterGrounding {
  /**
   * Grounds the character model so its lowest point sits exactly at Y = 0 plus adjustment.
   * @param {THREE.Object3D} model 
   * @param {number} offsetAdjustment
   */
  static ground(model, offsetAdjustment = 0) {
    if (!model) return;
    
    // Force matrix update to get correct world bounding box coordinates
    model.updateMatrixWorld(true);
    
    const box = new THREE.Box3().setFromObject(model);
    
    if (isFinite(box.min.y)) {
      // Offset calculates how far the lowest Y point is relative to the pivot.
      // E.g., if model is at Y=0 and lowest point is Y=-0.9, we set position Y to 0.9.
      const offset = model.position.y - box.min.y + offsetAdjustment;
      model.position.y = offset;
      model.userData.groundY = offset;
      console.log(`[CharacterGrounding] Model grounded successfully. Y position set to ${offset.toFixed(3)} (adjustment: ${offsetAdjustment})`);
    } else {
      // Fallback in case geometry bounds are not yet calculated or empty
      const offset = 0.9 + offsetAdjustment;
      model.position.y = offset;
      model.userData.groundY = offset;
      console.warn(`[CharacterGrounding] Bounding box invalid. Fallback Y = ${offset.toFixed(3)} applied.`);
    }
  }
}
