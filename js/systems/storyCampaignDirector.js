export const PHASE44_STORY_CAMPAIGN_DIRECTOR = Object.freeze({
  phase: '44',
  system: 'story-campaign-director',
  version: 'v2.0.0-alpha.59',
  layers: ['story-acts', 'mission-rail', 'next-operation', 'subofficer-campaign-guidance', 'post-mission-consequence'],
  mobileFirst: true,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function pct(completed, total) {
  return total > 0 ? Math.round((Number(completed || 0) / total) * 100) : 0;
}

const STORY_ACTS = Object.freeze([
  { id: 'act1', min: 0, titleKey: 'storyCampaign.act1.title', descKey: 'storyCampaign.act1.desc', directiveKey: 'storyCampaign.directive.firstPatrol' },
  { id: 'act2', min: 2, titleKey: 'storyCampaign.act2.title', descKey: 'storyCampaign.act2.desc', directiveKey: 'storyCampaign.directive.escalation' },
  { id: 'act3', min: 4, titleKey: 'storyCampaign.act3.title', descKey: 'storyCampaign.act3.desc', directiveKey: 'storyCampaign.directive.wolfpack' },
  { id: 'act4', min: 6, titleKey: 'storyCampaign.act4.title', descKey: 'storyCampaign.act4.desc', directiveKey: 'storyCampaign.directive.finalPush' },
]);

function resolveAct(completed = 0) {
  return STORY_ACTS.slice().reverse().find((act) => completed >= act.min) || STORY_ACTS[0];
}

function missionState(mission = {}, completedSet = new Set(), selectedMission = null) {
  if (completedSet.has(mission.id)) return 'completed';
  if (selectedMission?.id === mission.id) return 'active';
  if (mission.status === 'available') return 'available';
  return 'locked';
}

function missionBeatKey(state) {
  if (state === 'completed') return 'storyCampaign.beat.completed';
  if (state === 'active') return 'storyCampaign.beat.active';
  if (state === 'available') return 'storyCampaign.beat.available';
  return 'storyCampaign.beat.locked';
}

function directiveForMission(mission = {}, act = STORY_ACTS[0], front = {}) {
  if (mission?.sandbox || mission?.missionMode === 'sandbox') return 'storyCampaign.directive.sandbox';
  if (front?.directiveKey && front.directiveKey !== 'livingCampaign.directive.standard') return front.directiveKey;
  if (mission?.status === 'locked') return 'storyCampaign.directive.locked';
  return act.directiveKey;
}

export function buildStoryCampaignFlow({ campaign = null, missions = [], progress = {}, completedMissions = [], selectedMission = null, livingFront = null } = {}) {
  const safeMissions = Array.isArray(missions) ? missions.slice().sort((a, b) => Number(a.campaignOrder || 0) - Number(b.campaignOrder || 0)) : [];
  const completedSet = new Set(completedMissions || []);
  const completed = Number(progress.completed || safeMissions.filter((mission) => completedSet.has(mission.id)).length || 0);
  const total = Number(progress.total || safeMissions.length || 0);
  const act = resolveAct(completed);
  const nextMission = selectedMission || safeMissions.find((mission) => mission.status === 'available' && !completedSet.has(mission.id)) || safeMissions.find((mission) => !completedSet.has(mission.id)) || safeMissions[0] || null;
  const activeIndex = nextMission ? safeMissions.findIndex((mission) => mission.id === nextMission.id) : -1;
  const rail = safeMissions.map((mission, index) => {
    const state = missionState(mission, completedSet, nextMission);
    return {
      id: mission.id,
      order: mission.campaignOrder || index + 1,
      titleKey: mission.titleKey,
      operationKey: mission.operationKey,
      state,
      beatKey: missionBeatKey(state),
      active: nextMission?.id === mission.id,
      completed: state === 'completed',
    };
  });
  const completionPercent = pct(completed, total);
  const pressure = clamp((livingFront?.theaterPressure || livingFront?.pressure || 0) + completionPercent * 0.18, 0, 100);
  return {
    phase: PHASE44_STORY_CAMPAIGN_DIRECTOR.phase,
    system: PHASE44_STORY_CAMPAIGN_DIRECTOR.system,
    campaignId: campaign?.id || 'campaign.unknown',
    act,
    completed,
    total,
    completionPercent,
    nextMission,
    activeIndex,
    rail,
    pressure,
    directiveKey: directiveForMission(nextMission, act, livingFront || {}),
    subofficerKey: nextMission?.sandbox ? 'storyCampaign.subofficer.sandbox' : completed <= 0 ? 'storyCampaign.subofficer.initial' : pressure >= 66 ? 'storyCampaign.subofficer.pressure' : 'storyCampaign.subofficer.next',
    postMissionKey: completed > 0 ? 'storyCampaign.postMission.consequence' : 'storyCampaign.postMission.none',
  };
}

export function renderStoryCampaignPanel(t, flow = {}) {
  const next = flow.nextMission;
  const rail = Array.isArray(flow.rail) ? flow.rail : [];
  return `
    <section class="phase44-story-campaign-panel" data-story-act="${flow.act?.id || 'act1'}" aria-label="${t('storyCampaign.title')}">
      <div class="phase44-story-head">
        <div>
          <span>${t('storyCampaign.kicker')}</span>
          <strong>${t(flow.act?.titleKey || 'storyCampaign.act1.title')}</strong>
          <p>${t(flow.act?.descKey || 'storyCampaign.act1.desc')}</p>
        </div>
        <b>${flow.completed || 0}/${flow.total || 0}</b>
      </div>
      <div class="phase44-story-progress"><i style="width:${clamp(flow.completionPercent, 0, 100)}%"></i></div>
      <div class="phase44-story-subofficer">
        <img src="assets/avatars/de/officer_01.png" alt="" loading="lazy">
        <div>
          <span>${t('storyCampaign.subofficerLabel')}</span>
          <strong>${t(flow.subofficerKey || 'storyCampaign.subofficer.initial')}</strong>
          <small>${t(flow.directiveKey || 'storyCampaign.directive.firstPatrol')}</small>
        </div>
      </div>
      <div class="phase44-next-operation">
        <span>${t('storyCampaign.nextOperation')}</span>
        <strong>${next ? t(next.titleKey) : t('storyCampaign.noMission')}</strong>
        <p>${next ? t(next.summaryKey) : t('storyCampaign.noMissionDesc')}</p>
        <div>
          ${next ? `<em>${next.year}</em><em>${t(next.theatreKey)}</em><em>${t(next.operationKey)}</em>` : ''}
        </div>
      </div>
      <div class="phase44-story-rail">
        ${rail.map((item) => `
          <button class="phase44-story-beat ${item.state}" data-action="select-mission" data-mission="${item.id}">
            <span>${String(item.order).padStart(2, '0')}</span>
            <strong>${t(item.titleKey)}</strong>
            <small>${t(item.beatKey)}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}
