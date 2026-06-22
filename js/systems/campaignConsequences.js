function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function missionProgressForNation(campaign, completedMissionIds = []) {
  const completed = new Set(completedMissionIds || []);
  const missionIds = Array.isArray(campaign?.missionIds) ? campaign.missionIds : [];
  return {
    total: missionIds.length,
    completed: missionIds.filter((id) => completed.has(id)).length,
  };
}

function objectiveProgressForNation(objectiveSet, completedMissionIds = [], claimedRewardIds = []) {
  const completed = new Set(completedMissionIds || []);
  const claimed = new Set(claimedRewardIds || []);
  const objectives = Array.isArray(objectiveSet?.objectives) ? objectiveSet.objectives : [];
  const completedObjectives = objectives.filter((objective) => (objective.missionIds || []).every((id) => completed.has(id))).length;
  const claimedObjectives = objectives.filter((objective) => claimed.has(objective.id)).length;
  return { total: objectives.length, completed: completedObjectives, claimed: claimedObjectives };
}

export function findCampaignConsequenceForNation(items = [], nationId = '') {
  return (items || []).find((item) => item.nationId === nationId) || null;
}

export function calculateConsequenceEffect(consequence, completedMissions = 0, completedObjectives = 0) {
  const milestones = [...(consequence?.milestones || [])].sort((a, b) => Number(a.threshold || 0) - Number(b.threshold || 0));
  const current = milestones.reduce((best, milestone) => (completedMissions >= Number(milestone.threshold || 0) ? milestone : best), milestones[0] || null);
  const effect = current?.effect || {};
  return {
    milestone: current,
    riskDelta: Number(effect.riskDelta || 0),
    intelBonus: Number(effect.intelBonus || 0) + completedObjectives,
    readinessBonus: Number(effect.readinessBonus || 0),
    tonnageMultiplier: Math.max(0.8, Math.min(1.3, Number(effect.tonnageMultiplier || 1))),
  };
}

export function buildCampaignConsequenceDeck({ consequence, campaign, objectiveSet, completedMissionIds = [], claimedRewardIds = [] } = {}) {
  if (!consequence) return null;
  const missionProgress = missionProgressForNation(campaign, completedMissionIds);
  const objectiveProgress = objectiveProgressForNation(objectiveSet, completedMissionIds, claimedRewardIds);
  const tracks = (consequence.tracks || []).map((track) => {
    const value = Math.round(clamp((track.base || 0) + missionProgress.completed * (track.perMission || 0) + objectiveProgress.completed * (track.perObjective || 0), 0, track.max || 100));
    return { ...track, value, percent: clamp(value, 0, track.max || 100) };
  });
  const effect = calculateConsequenceEffect(consequence, missionProgress.completed, objectiveProgress.completed);
  return {
    id: consequence.id,
    nationId: consequence.nationId,
    titleKey: consequence.titleKey,
    summaryKey: consequence.summaryKey,
    frontKey: consequence.frontKey,
    missionProgress,
    objectiveProgress,
    tracks,
    effect,
  };
}
