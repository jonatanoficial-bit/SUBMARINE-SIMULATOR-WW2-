import { renderBottomNav, renderProgressMini, renderStatBar } from '../components/ui.js';

function pct(value, max) { return Math.round(Math.max(0, Math.min(100, (Number(value || 0) / Math.max(1, Number(max || 1))) * 100))); }
function supplyRow(t, labelKey, value, max) {
  const percent = pct(value, max);
  return `
    <div class="supply-row">
      <div class="row space-between"><span>${t(labelKey)}</span><strong>${Math.round(value || 0)} / ${Math.round(max || 0)}</strong></div>
      ${renderStatBar(percent)}
    </div>
  `;
}
function costTags(t, costs = {}) {
  return `
    <div class="mission-meta">
      <span class="tag">${t('logistics.fuel')}: ${costs.fuel || 0}</span>
      <span class="tag">${t('logistics.torpedoes')}: ${costs.torpedoes || 0}</span>
      <span class="tag">${t('logistics.deckAmmo')}: ${costs.deckAmmo || 0}</span>
      <span class="tag">${t('logistics.rations')}: ${costs.rations || 0}</span>
      <span class="tag">${t('logistics.spareParts')}: ${costs.spareParts || 0}</span>
    </div>
  `;
}

export function renderCareer(t, save, nation, campaign, selectedMission, logisticsBase, logisticsData, careerRank, readiness, previewPlans = []) {
  const career = save.career || {};
  const logistics = save.logistics || {};
  const ranks = logisticsData?.ranks?.[nation.id] || [];
  const nextRank = ranks[Math.min((career.rankIndex || 0) + 1, ranks.length - 1)];
  const currentRank = careerRank || ranks[0] || { key: 'common.rank', reputation: 0 };
  const nextTarget = nextRank?.reputation ?? Math.max(1, career.reputation || 1);
  const activePlan = logistics.activePlan;
  const medals = career.medals || [];
  const record = career.serviceRecord || [];

  return `
    <section class="screen screen-shell phase12-career-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('career.title')}</div>
          <div class="screen-subtitle">${t('career.subtitle')}</div>
        </div>
        <span class="top-badge">${t(nation.nameKey)} • ${t(logisticsBase.homePortKey)}</span>
      </div>

      <div class="phase12-grid">
        <div class="panel career-command-panel edge-glow">
          <div class="panel-header">${t('career.command')}</div>
          <div class="panel-body stack">
            <div class="career-rank-card">
              <div class="rank-emblem">★</div>
              <div class="grow">
                <div class="kicker">${t('career.currentRank')}</div>
                <h2>${t(currentRank.key)}</h2>
                <p class="muted">${t('career.rankHint')}</p>
              </div>
            </div>
            <div class="row space-between"><strong>${t('career.reputation')}</strong><span>${career.reputation || 0}/${nextTarget}</span></div>
            ${renderProgressMini(career.reputation || 0, nextTarget)}
            <div class="stat-strip phase12-stat-strip">
              <div class="stat-box"><div class="stat-label">${t('career.patrols')}</div><div class="stat-value">${career.patrols || 0}</div></div>
              <div class="stat-box"><div class="stat-label">${t('career.tonnage')}</div><div class="stat-value">${career.tonnage || 0}</div></div>
              <div class="stat-box"><div class="stat-label">${t('career.prestige')}</div><div class="stat-value">${career.prestige || 0}</div></div>
            </div>
            <div class="mission-meta">
              <span class="tag gold">${t('career.victories')}: ${career.victories || 0}</span>
              <span class="tag">${t('career.convoyDisruption')}: ${career.convoyDisruption || 0}%</span>
              <span class="tag warn">${t('career.campaignPressure')}: ${career.campaignPressure || 0}%</span>
            </div>
          </div>
        </div>

        <div class="panel logistics-readiness-panel">
          <div class="panel-header">${t('logistics.readiness')}</div>
          <div class="panel-body stack">
            <div class="readiness-dial"><strong>${readiness.overall}%</strong><span>${t(readiness.labelKey)}</span></div>
            <div class="stat-strip phase12-stat-strip">
              <div class="stat-box"><div class="stat-label">${t('logistics.morale')}</div><div class="stat-value">${logistics.morale ?? 0}%</div></div>
              <div class="stat-box"><div class="stat-label">${t('logistics.fatigue')}</div><div class="stat-value">${logistics.fatigue ?? 0}%</div></div>
              <div class="stat-box"><div class="stat-label">${t('logistics.dockDays')}</div><div class="stat-value">${logistics.dockDays ?? 0}</div></div>
            </div>
            <div class="empty-state compact"><strong>${t('logistics.staff')}</strong><br>${t(logisticsBase.staffKey)}</div>
            <div class="row wrap">
              <button class="button secondary" data-action="restock-logistics">${t('logistics.restock')}</button>
              <button class="button ghost" data-action="rest-crew">${t('logistics.restCrew')}</button>
              <button class="button ghost" data-action="dock-maintenance">${t('logistics.dockMaintenance')}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel sortie-planning-panel">
        <div class="panel-header">${t('logistics.sortiePlanning')}</div>
        <div class="panel-body stack">
          <div class="row space-between align-start wrap">
            <div>
              <h3>${selectedMission ? t(selectedMission.titleKey) : t('campaign.play')}</h3>
              <p class="muted">${selectedMission ? t(selectedMission.summaryKey) : t('campaign.placeholder')}</p>
            </div>
            <span class="tag ${activePlan?.missionId === selectedMission?.id ? 'success' : 'gold'}">${activePlan?.missionId === selectedMission?.id ? t('logistics.planActive') : t('logistics.planRequired')}</span>
          </div>
          ${activePlan?.missionId === selectedMission?.id ? `
            <div class="active-plan-card">
              <strong>${t('logistics.activePlan')}</strong>
              <span>${t('logistics.activePlanHint', { readiness: activePlan.readiness || 0 })}</span>
              ${costTags(t, activePlan.costs || {})}
            </div>
          ` : ''}
          <div class="plan-profile-grid">
            ${previewPlans.map((plan) => `
              <div class="mission-card plan-card ${plan.canAfford ? '' : 'locked'}">
                <div class="row space-between align-start">
                  <div>
                    <h3>${t(plan.labelKey)}</h3>
                    <p>${t(plan.descKey)}</p>
                  </div>
                  <span class="tag ${plan.canAfford ? 'success' : 'warn'}">${plan.readiness}%</span>
                </div>
                ${costTags(t, plan.costs)}
                <button class="button block ${plan.canAfford ? '' : 'secondary'}" data-action="plan-patrol" data-plan="${plan.id}" ${plan.canAfford ? '' : 'disabled'}>${t('logistics.preparePlan')}</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="phase12-grid">
        <div class="panel supply-panel">
          <div class="panel-header">${t('logistics.supplies')}</div>
          <div class="panel-body stack">
            ${supplyRow(t, 'logistics.fuel', logistics.fuel, logisticsBase.fuelMax)}
            ${supplyRow(t, 'logistics.torpedoes', logistics.torpedoes, logisticsBase.torpedoMax)}
            ${supplyRow(t, 'logistics.deckAmmo', logistics.deckAmmo, logisticsBase.deckAmmoMax)}
            ${supplyRow(t, 'logistics.rations', logistics.rations, logisticsBase.rationMax)}
            ${supplyRow(t, 'logistics.spareParts', logistics.spareParts, logisticsBase.sparePartsMax)}
          </div>
        </div>

        <div class="panel medals-panel">
          <div class="panel-header">${t('career.medals')}</div>
          <div class="panel-body stack">
            ${medals.length ? `<div class="medal-grid">${medals.map((id) => {
              const medal = logisticsData.medals.find((item) => item.id === id);
              return `<div class="medal-card"><span>◆</span><strong>${t(medal?.key || id)}</strong></div>`;
            }).join('')}</div>` : `<div class="empty-state">${t('career.noMedals')}</div>`}
            <button class="button secondary block" data-action="export-logbook">${t('career.exportLogbook')}</button>
          </div>
        </div>
      </div>

      <div class="panel service-record-panel">
        <div class="panel-header">${t('career.serviceRecord')}</div>
        <div class="panel-body stack">
          ${record.length ? record.slice(0, 6).map((item) => `
            <div class="record-line">
              <strong>${item.missionTitle || item.missionId}</strong>
              <span>${t('career.recordLine', { score: item.score || 0, tonnage: item.tonnage || 0, reputation: item.reputationGained || 0 })}</span>
            </div>
          `).join('') : `<div class="empty-state">${t('career.noRecord')}</div>`}
        </div>
      </div>

      ${renderBottomNav('career', t)}
    </section>
  `;
}
