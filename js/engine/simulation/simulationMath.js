import { DEPTH_MAX, DEPTH_MIN, TARGET_LOCK_X, TARGET_LOCK_Y, VIEW_RANGE_X, VIEW_RANGE_Y } from './constants.js';

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function depthToAngle(depth, maxDepth = DEPTH_MAX) {
  return -120 + (clamp(depth, DEPTH_MIN, maxDepth) / maxDepth) * 240;
}

export function worldToViewPosition(entity, view) {
  const dx = entity.x - view.x;
  const dy = entity.y - view.y;
  return {
    left: 50 + (dx / VIEW_RANGE_X) * 50,
    bottom: 22 + (dy / VIEW_RANGE_Y) * 18,
    dx,
    dy,
  };
}

export function computeTargetLock({ depth, target, view, systems, targetDestroyed, periscopeMaxDepth }) {
  if (depth > periscopeMaxDepth || targetDestroyed) return false;
  const { dx, dy } = worldToViewPosition(target, view);
  const weaponAssist = (systems.weapons ?? 100) < 35 ? -18 : 0;
  const periscopeAssist = (systems.periscope ?? 100) < 35 ? -14 : 0;
  return Math.abs(dx) <= TARGET_LOCK_X + weaponAssist + periscopeAssist
    && Math.abs(dy) <= TARGET_LOCK_Y + weaponAssist + periscopeAssist;
}

export function buildMissionReport({ hull, systems, maxDetection, shots, mission }) {
  const hullScore = Math.max(0, Math.round(hull));
  const stealthScore = Math.max(0, 100 - Math.round(maxDetection));
  const shotScore = Math.max(0, 100 - Math.max(0, shots - 1) * 25);
  const systemMin = Math.min(...Object.values(systems || { engines: 100, sonar: 100, periscope: 100, weapons: 100 }));
  const systemScore = Math.max(0, Math.round(systemMin));
  const score = Math.round((hullScore * 0.32) + (stealthScore * 0.28) + (shotScore * 0.22) + (systemScore * 0.18));
  const bonusCredits = Math.round((mission?.bonusReward || 450) * (score / 100));
  const bonusXp = Math.round((mission?.bonusXp || 60) * (score / 100));
  return { score, bonusCredits, bonusXp, hull: hullScore, stealth: stealthScore, shots };
}
