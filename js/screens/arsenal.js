import { renderBottomNav, renderStatBar } from '../components/ui.js';

function submarineGateText(t, item = null) {
  if (!item?.gate?.reason) return t('careerRetention.unlocked');
  return t(item.lockKey || item.gate.reasonKey, { current: item.gate.reason.current, required: item.gate.reason.required });
}

function arsenalRetentionMarkup(t, retention = null) {
  if (!retention) return '';
  const freeModes = retention.freeModes || [];
  return `
    <div class="panel phase54-career-retention-panel arsenal-retention" data-morale="${retention.morale?.tone || 'stable'}">
      <div class="panel-header">${t('careerRetention.arsenalTitle')}</div>
      <div class="panel-body stack">
        <div class="phase54-retention-top">
          <div class="phase54-morale-dial"><strong>${retention.stats?.morale || 0}%</strong><span>${t(retention.moraleKey || 'careerRetention.morale.stable')}</span></div>
          <div><div class="kicker">${t('careerRetention.arsenalKicker')}</div><h3>${t('careerRetention.arsenalHeading')}</h3><p class="muted compact-text">${t('careerRetention.arsenalSubtitle')}</p></div>
        </div>
        <div class="phase54-free-grid">${freeModes.map((mode) => `<div class="phase54-free-card ${mode.unlocked ? 'complete' : ''}"><span>${t(mode.key)}</span><strong>${mode.unlocked ? t('common.available') : t('common.locked')}</strong><small>${t('careerRetention.requiresVictories', { count: mode.requires })}</small></div>`).join('')}</div>
      </div>
    </div>`;
}

export function renderArsenal(t, submarines, currentId, level, credits, ownedUpgrades, upgrades, submarineState = null, workshopImpact = null, careerRetention = null) {
  const hull = submarineState?.hull ?? 100;
  const systems = submarineState?.systems || { engines: 100, sonar: 100, periscope: 100, weapons: 100 };
  const damagedSystems = Object.values(systems).some((value) => value < 100);
  const repairCost = Math.max(250, Math.ceil((100 - hull) * 18) + (damagedSystems ? 400 : 0));
  return `
    <section class="screen screen-shell arsenal-screen">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('arsenal.title')}</div>
          <div class="screen-subtitle">${t('arsenal.subtitle')}</div>
        </div>
        <span class="tag success">${t('common.credits')}: ${credits}</span>
      </div>

      <details class="progressive-section">
        <summary>${t('careerRetention.arsenalTitle')}</summary>
        <div class="progressive-section-body stack">${arsenalRetentionMarkup(t, careerRetention)}</div>
      </details>

      <div class="stack arsenal-sub-list">
        ${submarines.map((submarine) => {
          const market = careerRetention?.submarineMarketById?.[submarine.id] || null;
          const isCurrent = submarine.id === currentId;
          const isOwned = submarine.unlocked || submarine.owned || market?.owned;
          const locked = Boolean(market && !market.unlocked && !isOwned);
          const canUnlock = market ? market.canBuy : (!isOwned && level >= submarine.levelRequired);
          return `
            <div class="sub-card phase54-sub-shop-card ${isCurrent ? 'active' : ''} ${locked ? 'locked' : ''}" data-tier="${market?.tier || submarine.tier || 'trained'}">
              <div class="sub-visual"><img src="${submarine.image}" alt="${submarine.name}"></div>
              <div class="row space-between align-start" style="margin-top: 10px; gap:10px;">
                <div>
                  <h3>${submarine.name}</h3>
                  <p>${isOwned ? t('arsenal.note') : t('arsenal.unlockFor', { credits: submarine.unlockCost || 0, level: submarine.levelRequired })}</p>
                </div>
                <span class="tag ${isCurrent ? 'success' : (isOwned ? 'gold' : 'warn')}">${isCurrent ? t('arsenal.current') : (isOwned ? t('common.available') : t('common.locked'))}</span>
              </div>
              <div class="mission-meta">
                <span class="tag gold">${t(market?.tierKey || 'careerRetention.tier.trained')}</span>
                <span class="tag">${t('careerRetention.unlock')}: ${submarineGateText(t, market)}</span>
              </div>
              <div class="stack" style="margin-top: 12px; gap: 10px;">
                ${Object.entries(submarine.stats).map(([key, value]) => `
                  <div class="stack" style="gap: 6px;">
                    <div class="row space-between"><span>${t(`arsenal.stats.${key}`)}</span><strong>${value}</strong></div>
                    ${renderStatBar(value)}
                  </div>
                `).join('')}
              </div>
              <div class="row wrap" style="margin-top:12px; gap:10px;">
                ${isOwned && !isCurrent ? `<button class="button ghost" data-action="equip-submarine" data-submarine="${submarine.id}">${t('arsenal.equip')}</button>` : ''}
                ${canUnlock ? `<button class="button" data-action="unlock-submarine" data-submarine="${submarine.id}">${t('arsenal.unlock')}</button>` : (!isOwned ? `<button class="button secondary" disabled>${locked ? t('careerRetention.locked') : t('common.locked')}</button>` : '')}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${workshopImpact ? `<details class="progressive-section">
      <summary>${t('workshop.title')}</summary>
      <div class="progressive-section-body">
      <div class="panel phase42-workshop-impact">
        <div class="panel-header">${t('workshop.title')}</div>
        <div class="panel-body stack">
          <div class="phase42-workshop-top">
            <div class="phase42-readiness-dial" data-state="${workshopImpact.readiness.state}">
              <strong>${workshopImpact.readiness.score}%</strong>
              <span>${t(workshopImpact.readiness.key)}</span>
            </div>
            <div>
              <div class="phase42-impact-grid">
                ${workshopImpact.cards.map((card) => `
                  <div class="phase42-impact-card" data-category="${card.category}">
                    <span>${t(card.titleKey)}</span>
                    <strong>${card.value}</strong>
                    <p>${t(card.detailKey)}</p>
                  </div>
                `).join('')}
              </div>
              <div class="phase42-directive">${t(workshopImpact.directiveKey)}</div>
            </div>
          </div>
          <div class="phase42-workshop-actions">
            <button class="button secondary" data-action="restock-logistics">${t('logistics.restock')}</button>
            <button class="button secondary" data-action="dock-maintenance">${t('workshop.dockMaintenance')}</button>
            <button class="button secondary" data-action="rest-crew">${t('workshop.restCrew')}</button>
          </div>
        </div>
      </div>
      </div>
      </details>` : ''}

      <div class="panel repair-panel">
        <div class="panel-header">${t('repair.title')}</div>
        <div class="panel-body stack">
          <div class="row space-between"><span>${t('repair.hull')}</span><strong>${Math.round(hull)}%</strong></div>
          <div class="progress-bar"><span style="width:${Math.max(0, Math.min(100, hull))}%"></span></div>
          <div class="mission-meta">
            <span class="tag">${t('repair.engines')}: ${Math.round(systems.engines ?? 100)}%</span>
            <span class="tag">${t('repair.sonar')}: ${Math.round(systems.sonar ?? 100)}%</span>
            <span class="tag">${t('repair.periscope')}: ${Math.round(systems.periscope ?? 100)}%</span>
            <span class="tag">${t('repair.weapons')}: ${Math.round(systems.weapons ?? 100)}%</span>
          </div>
          ${(hull < 100 || damagedSystems) ? `<button class="button block" data-action="repair-submarine">${t('repair.fullRepair', { cost: repairCost })}</button>` : `<div class="empty-state">${t('repair.noDamage')}</div>`}
        </div>
      </div>

      <details class="progressive-section">
        <summary>${t('arsenal.upgrades')}</summary>
        <div class="progressive-section-body">
          <div class="panel upgrades-panel">
            <div class="panel-header">${t('arsenal.upgrades')}</div>
            <div class="panel-body stack">
          ${upgrades.map((upgrade) => {
            const owned = ownedUpgrades.includes(upgrade.id);
            return `
              <div class="mission-card ${owned ? 'active' : ''}">
                <div class="row space-between align-start">
                  <div>
                    <h3>${t(upgrade.nameKey)}</h3>
                    <p>${t(upgrade.descKey)}</p>
                  </div>
                  <span class="tag ${owned ? 'success' : 'gold'}">${owned ? t('arsenal.installed') : upgrade.cost}</span>
                </div>
                <div class="mission-meta">
                  <span class="tag">${t('arsenal.category.' + upgrade.category)}</span>
                  <span class="tag">Lv ${upgrade.levelRequired}</span>
                </div>
                <div class="phase42-upgrade-effect-tags">
                  ${Object.entries(upgrade.effect || {}).map(([key, value]) => `<span class="tag">${t('workshop.effect.' + key)} ${Number(value) >= 0 ? '+' : ''}${value}</span>`).join('')}
                </div>
                ${owned ? `<div class="phase42-directive">${t('workshop.installedImpact')}</div>` : `<button class="button secondary block" data-action="buy-upgrade" data-upgrade="${upgrade.id}">${t('arsenal.buyUpgrade')}</button>`}
              </div>
            `;
          }).join('')}
            </div>
          </div>
        </div>
      </details>

      ${renderBottomNav('arsenal', t)}
    </section>
  `;
}
