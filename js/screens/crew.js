import { renderBottomNav } from '../components/ui.js';
import { CREW_STATIONS, assessCrewReadiness } from '../systems/crewReadiness.js';

function stationMarkup(t, readiness) {
  const coverage = readiness.stationCoverage;
  return CREW_STATIONS.map((station) => {
    const slot = coverage[station.id];
    const stationValue = readiness.stationReadiness[station.id] || slot.skill || 0;
    return `
      <div class="crew-station-card ${slot.covered ? 'covered' : 'uncovered'}">
        <span>${t(station.labelKey)}</span>
        <strong>${stationValue}%</strong>
        <small>${slot.lead ? slot.lead.name : t('crew.station.uncovered')}</small>
        <div class="progress-bar"><span style="width:${stationValue}%"></span></div>
      </div>`;
  }).join('');
}

function watchMarkup(t, readiness) {
  if (!readiness.watchRotation.length) {
    return `<div class="crew-watch-card"><span>${t('crew.watch.empty')}</span><strong>${t('crew.empty')}</strong><small>${t('crew.rec.coverage')}</small></div>`;
  }
  return readiness.watchRotation.map((watch) => `
    <div class="crew-watch-card">
      <span>${t('crew.watch')} ${watch.watch}</span>
      <strong>${watch.name}</strong>
      <small>${t(watch.roleKey)} • ${t(`crew.station.${watch.station}`)} • ${t('crew.fatigue')}: ${watch.fatigueLoad}%</small>
    </div>`).join('');
}

function recommendationsMarkup(t, readiness) {
  return readiness.recommendations.map((rec) => `
    <div class="crew-rec-card">
      <span>${t('crew.recommendation')}</span>
      <strong>${t(rec.key)}</strong>
      <small>${rec.stations?.length ? rec.stations.map((station) => t(`crew.station.${station}`)).join(' • ') : t(`crew.status.${readiness.status}`)}</small>
    </div>`).join('');
}

export function renderCrew(t, crewMembers, hiredIds, credits, save = {}) {
  const readiness = assessCrewReadiness(crewMembers, hiredIds, save || {});
  return `
    <section class="screen screen-shell crew-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('crew.title')}</div>
          <div class="screen-subtitle">${t('crew.subtitle')}</div>
        </div>
        <span class="tag success">${t('common.credits')}: ${credits}</span>
      </div>

      <div class="panel crew-readiness-panel">
        <div class="panel-header">${t('crew.readinessTitle')}</div>
        <div class="panel-body crew-readiness-grid">
          <div class="crew-readiness-core">
            <div class="crew-readiness-badge">
              <div>
                <strong>${readiness.readiness}%</strong>
                <span>${t('crew.readiness')}</span>
              </div>
            </div>
            <div class="crew-readiness-state">${t(`crew.status.${readiness.status}`)}</div>
            <div class="crew-mini-metrics">
              <div class="crew-mini-metric"><span>${t('crew.morale')}</span><strong>${readiness.morale}%</strong></div>
              <div class="crew-mini-metric"><span>${t('crew.fatigue')}</span><strong>${readiness.fatigue}%</strong></div>
              <div class="crew-mini-metric"><span>${t('crew.coverage')}</span><strong>${readiness.coverageScore}%</strong></div>
              <div class="crew-mini-metric"><span>${t('crew.averageSkill')}</span><strong>${readiness.averageSkill}%</strong></div>
            </div>
          </div>
          <div>
            <div class="crew-readiness-title">${t('crew.stationCoverage')}</div>
            <div class="crew-station-grid">${stationMarkup(t, readiness)}</div>
            <div class="crew-readiness-title" style="margin-top:14px;">${t('crew.watchRotation')}</div>
            <div class="crew-watch-grid">${watchMarkup(t, readiness)}</div>
            <div class="crew-readiness-title" style="margin-top:14px;">${t('crew.recommendations')}</div>
            <div class="crew-rec-grid">${recommendationsMarkup(t, readiness)}</div>
          </div>
        </div>
      </div>

      <div class="stack crew-list">
        ${crewMembers.map((crew) => {
          const hired = hiredIds.includes(crew.id);
          const level = crew.level ?? Math.max(1, Math.round((Number(crew.skill || 50) - 45) / 10));
          return `
            <div class="crew-card ${hired ? 'active' : ''}">
              <div class="crew-avatar"><img src="${crew.avatar}" alt="${crew.name}"></div>
              <div class="stack" style="gap: 8px;">
                <div class="row space-between align-start">
                  <div>
                    <h3>${crew.name}</h3>
                    <p>${t(crew.roleKey)} • ${t(crew.bonusKey)} • ${t(crew.bioKey)}</p>
                  </div>
                  <span class="tag ${hired ? 'success' : 'gold'}">${hired ? t('crew.hired') : crew.cost}</span>
                </div>
                <div class="row wrap space-between">
                  <span>${t('crew.skill')}: ${crew.skill}%</span>
                  <span>${t('common.level')}: ${level}</span>
                </div>
                <div class="progress-bar"><span style="width:${crew.skill}%"></span></div>
                ${hired ? '' : `<button class="button ghost" data-action="toggle-crew" data-crew="${crew.id}">${t('crew.hire')}</button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${renderBottomNav('crew', t)}
    </section>
  `;
}
