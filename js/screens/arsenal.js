import { renderBottomNav, renderStatBar } from '../components/ui.js';

export function renderArsenal(t, submarines, currentId, level, credits, ownedUpgrades, upgrades, submarineState = null) {
  const hull = submarineState?.hull ?? 100;
  const systems = submarineState?.systems || { engines: 100, sonar: 100, periscope: 100, weapons: 100 };
  const damagedSystems = Object.values(systems).some((value) => value < 100);
  const repairCost = Math.max(250, Math.ceil((100 - hull) * 18) + (damagedSystems ? 400 : 0));
  return `
    <section class="screen screen-shell">
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-title">${t('arsenal.title')}</div>
          <div class="screen-subtitle">${t('arsenal.subtitle')}</div>
        </div>
        <span class="tag success">${t('common.credits')}: ${credits}</span>
      </div>

      <div class="stack">
        ${submarines.map((submarine) => {
          const isCurrent = submarine.id === currentId;
          const isOwned = submarine.unlocked || submarine.owned;
          const canUnlock = !isOwned && level >= submarine.levelRequired;
          return `
            <div class="sub-card ${isCurrent ? 'active' : ''}">
              <div class="sub-visual"><img src="${submarine.image}" alt="${submarine.name}"></div>
              <div class="row space-between align-start" style="margin-top: 10px; gap:10px;">
                <div>
                  <h3>${submarine.name}</h3>
                  <p>${isOwned ? t('arsenal.note') : t('arsenal.unlockFor', { credits: submarine.unlockCost || 0, level: submarine.levelRequired })}</p>
                </div>
                <span class="tag ${isCurrent ? 'success' : (isOwned ? 'gold' : 'warn')}">${isCurrent ? t('arsenal.current') : (isOwned ? t('common.available') : t('common.locked'))}</span>
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
                ${canUnlock ? `<button class="button" data-action="unlock-submarine" data-submarine="${submarine.id}">${t('arsenal.unlock')}</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>


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

      <div class="panel">
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
                ${owned ? '' : `<button class="button secondary block" data-action="buy-upgrade" data-upgrade="${upgrade.id}">${t('arsenal.buyUpgrade')}</button>`}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${renderBottomNav('arsenal', t)}
    </section>
  `;
}
