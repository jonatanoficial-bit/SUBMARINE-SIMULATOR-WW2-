function asSet(values = []) {
  return new Set(Array.isArray(values) ? values.filter((value) => typeof value === 'string' && value.trim()) : []);
}

function cleanReward(reward = {}) {
  return {
    credits: Math.max(0, Math.round(Number(reward.credits) || 0)),
    xp: Math.max(0, Math.round(Number(reward.xp) || 0)),
    commandPoints: Math.max(0, Math.round(Number(reward.commandPoints) || 0)),
    reputation: Math.max(0, Math.round(Number(reward.reputation) || 0)),
    prestige: Math.max(0, Math.round(Number(reward.prestige) || 0)),
    intel: Math.max(0, Math.round(Number(reward.intel) || 0)),
    pressureRelief: Math.max(0, Math.round(Number(reward.pressureRelief) || 0)),
  };
}

export function findCampaignObjectivesForNation(objectiveSets = [], nationId = '') {
  return (Array.isArray(objectiveSets) ? objectiveSets : []).find((item) => item?.nationId === nationId) || null;
}

export function objectiveProgress(objective = {}, completedMissions = []) {
  const completed = asSet(completedMissions);
  const missionIds = Array.isArray(objective.missionIds) ? objective.missionIds : [];
  const done = missionIds.filter((missionId) => completed.has(missionId)).length;
  return {
    done,
    total: missionIds.length,
    percent: missionIds.length ? Math.round((done / missionIds.length) * 100) : 0,
    completed: missionIds.length > 0 && done >= missionIds.length,
  };
}

export function buildCampaignObjectiveDeck(objectiveSet = null, completedMissions = [], claimedObjectiveIds = []) {
  if (!objectiveSet) return { titleKey: '', summaryKey: '', objectives: [], completed: 0, total: 0 };
  const claimed = asSet(claimedObjectiveIds);
  const objectives = (Array.isArray(objectiveSet.objectives) ? objectiveSet.objectives : []).map((objective) => {
    const progress = objectiveProgress(objective, completedMissions);
    return {
      ...objective,
      reward: cleanReward(objective.reward),
      progress,
      claimed: claimed.has(objective.id),
    };
  });
  return {
    id: objectiveSet.id,
    nationId: objectiveSet.nationId,
    titleKey: objectiveSet.titleKey,
    summaryKey: objectiveSet.summaryKey,
    objectives,
    completed: objectives.filter((objective) => objective.progress.completed).length,
    claimed: objectives.filter((objective) => objective.claimed).length,
    total: objectives.length,
  };
}

export function getNewlyCompletedObjectiveRewards(objectiveSet = null, completedBefore = [], completedAfter = [], claimedObjectiveIds = []) {
  const claimed = asSet(claimedObjectiveIds);
  return (Array.isArray(objectiveSet?.objectives) ? objectiveSet.objectives : [])
    .filter((objective) => !claimed.has(objective.id))
    .filter((objective) => !objectiveProgress(objective, completedBefore).completed && objectiveProgress(objective, completedAfter).completed)
    .map((objective) => ({
      id: objective.id,
      titleKey: objective.titleKey,
      effectKey: objective.effectKey,
      reward: cleanReward(objective.reward),
    }));
}
