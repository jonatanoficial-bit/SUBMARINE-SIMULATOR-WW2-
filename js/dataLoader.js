const DATA_FILES = {
  nations: 'data/nations.json',
  submarines: 'data/submarines.json',
  crew: 'data/crew.json',
  missions: 'data/missions.json',
  campaigns: 'data/campaigns.json',
  campaignDoctrines: 'data/campaign_doctrines.json',
  logistics: 'data/logistics.json',
  strategy: 'data/strategy.json',
  upgrades: 'data/upgrades.json',
  ptBR: 'data/translations/pt-BR.json',
  en: 'data/translations/en.json',
  es: 'data/translations/es.json'
};

async function fetchJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) throw new Error(`${path}: invalid content type ${contentType || 'unknown'}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function assertArray(name, value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${name} must be a non-empty array`);
}

function assertUniqueIds(name, items) {
  const ids = new Set();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`${name}[${index}] is invalid`);
    if (typeof item.id !== 'string' || !item.id.trim()) throw new Error(`${name}[${index}] has no id`);
    if (ids.has(item.id)) throw new Error(`${name} duplicate id: ${item.id}`);
    ids.add(item.id);
  });
  return ids;
}

function validateTranslations(translations) {
  const languages = Object.keys(translations);
  const baseKeys = Object.keys(translations['pt-BR'] || {}).sort();
  if (!baseKeys.length) throw new Error('Portuguese translation dictionary is empty');
  languages.forEach((language) => {
    const dictionary = translations[language];
    if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) {
      throw new Error(`Invalid translation dictionary: ${language}`);
    }
    const keys = Object.keys(dictionary).sort();
    const missing = baseKeys.filter((key) => !(key in dictionary));
    const extra = keys.filter((key) => !(key in translations['pt-BR']));
    if (missing.length || extra.length) {
      throw new Error(`Translation key mismatch in ${language}: missing=${missing.length}, extra=${extra.length}`);
    }
  });
}


function validateMissionNavigation(missions) {
  const finite = (value) => Number.isFinite(Number(value));
  const inside = (point, bounds) => finite(point?.lat) && finite(point?.lon)
    && Number(point.lat) <= Number(bounds.north) && Number(point.lat) >= Number(bounds.south)
    && Number(point.lon) <= Number(bounds.east) && Number(point.lon) >= Number(bounds.west);
  missions.forEach((mission) => {
    const navigation = mission.navigation;
    if (!navigation || typeof navigation !== 'object') throw new Error(`Mission ${mission.id} has no navigation plan`);
    const bounds = navigation.mapBounds || {};
    if (![bounds.north, bounds.south, bounds.west, bounds.east].every(finite)
      || Number(bounds.north) <= Number(bounds.south) || Number(bounds.east) <= Number(bounds.west)) {
      throw new Error(`Mission ${mission.id} has invalid navigation map bounds`);
    }
    if (!inside(navigation.origin, bounds)) throw new Error(`Mission ${mission.id} origin is outside map bounds`);
    if (!Array.isArray(navigation.route) || navigation.route.length < 1 || navigation.route.length > 8) {
      throw new Error(`Mission ${mission.id} route must contain 1 to 8 waypoints`);
    }
    navigation.route.forEach((waypoint, index) => {
      if (!inside(waypoint, bounds)) throw new Error(`Mission ${mission.id} waypoint ${index + 1} is outside map bounds`);
    });
    const sector = navigation.patrolSector || {};
    if (![sector.north, sector.south, sector.west, sector.east].every(finite)
      || Number(sector.north) <= Number(sector.south) || Number(sector.east) <= Number(sector.west)
      || !inside({ lat: sector.north, lon: sector.west }, bounds)
      || !inside({ lat: sector.south, lon: sector.east }, bounds)) {
      throw new Error(`Mission ${mission.id} has invalid patrol sector`);
    }
  });
}

function validateRelations(data) {
  const nationIds = assertUniqueIds('nations', data.nations);
  const submarineIds = assertUniqueIds('submarines', data.submarines);
  assertUniqueIds('crew', data.crew);
  const missionIds = assertUniqueIds('missions', data.missions);
  const campaignIds = assertUniqueIds('campaigns', data.campaigns);
  const doctrineIds = assertUniqueIds('campaignDoctrines', data.campaignDoctrines || []);
  assertUniqueIds('upgrades', data.upgrades);
  assertUniqueIds('logistics.bases', data.logistics.bases);

  if (!data.logistics || typeof data.logistics !== 'object') throw new Error('Invalid logistics data');
  if (!Array.isArray(data.logistics.bases) || data.logistics.bases.length !== data.nations.length) throw new Error('Logistics bases must cover every nation');
  if (!Array.isArray(data.logistics.planningProfiles) || data.logistics.planningProfiles.length < 3) throw new Error('Logistics planning profiles missing');
  assertUniqueIds('logistics.planningProfiles', data.logistics.planningProfiles);
  if (!data.logistics.ranks || typeof data.logistics.ranks !== 'object') throw new Error('Logistics rank ladders missing');

  if (!data.strategy || typeof data.strategy !== 'object') throw new Error('Invalid strategy data');
  if (!Array.isArray(data.strategy.theaters) || data.strategy.theaters.length !== data.nations.length) throw new Error('Strategy theaters must cover every nation');
  if (!Array.isArray(data.strategy.convoyLanes) || data.strategy.convoyLanes.length < data.nations.length) throw new Error('Strategy convoy lanes missing');
  if (!Array.isArray(data.strategy.directives) || data.strategy.directives.length < 3) throw new Error('Strategy directives missing');
  if (!Array.isArray(data.strategy.intelNetworks) || data.strategy.intelNetworks.length !== data.nations.length) throw new Error('Strategy intel networks must cover every nation');
  assertUniqueIds('strategy.theaters', data.strategy.theaters);
  assertUniqueIds('strategy.convoyLanes', data.strategy.convoyLanes);
  assertUniqueIds('strategy.directives', data.strategy.directives);
  assertUniqueIds('strategy.intelNetworks', data.strategy.intelNetworks);

  if ((data.campaignDoctrines || []).length !== data.nations.length) throw new Error('Campaign doctrines must cover every nation');
  data.campaignDoctrines.forEach((doctrine) => {
    if (!nationIds.has(doctrine.nationId)) throw new Error(`Doctrine ${doctrine.id} has invalid nation ${doctrine.nationId}`);
    if (!Array.isArray(doctrine.traitKeys) || doctrine.traitKeys.length < 3) throw new Error(`Doctrine ${doctrine.id} needs at least three traits`);
    if (!Array.isArray(doctrine.stages) || doctrine.stages.length < 3) throw new Error(`Doctrine ${doctrine.id} needs progression stages`);
    const modifiers = doctrine.modifiers || {};
    ['fuelMultiplier','torpedoMultiplier','tonnageMultiplier'].forEach((key) => {
      if (!Number.isFinite(Number(modifiers[key]))) throw new Error(`Doctrine ${doctrine.id} missing numeric ${key}`);
    });
  });
  data.nations.forEach((nation) => {
    if (!data.campaignDoctrines.some((doctrine) => doctrine.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no campaign doctrine`);
  });

  data.campaigns.forEach((campaign) => {
    if (!nationIds.has(campaign.nationId)) throw new Error(`Campaign ${campaign.id} has invalid nation ${campaign.nationId}`);
    if (!Array.isArray(campaign.missionIds) || !campaign.missionIds.length) throw new Error(`Campaign ${campaign.id} has no mission ids`);
    campaign.missionIds.forEach((missionId) => {
      if (!missionIds.has(missionId)) throw new Error(`Campaign ${campaign.id} references missing mission ${missionId}`);
    });
  });
  data.missions.forEach((mission) => {
    if (!nationIds.has(mission.nationId)) throw new Error(`Mission ${mission.id} has invalid nation ${mission.nationId}`);
    if (!campaignIds.has(mission.campaignId)) throw new Error(`Mission ${mission.id} has invalid campaign ${mission.campaignId}`);
    const campaign = data.campaigns.find((item) => item.id === mission.campaignId);
    if (!campaign?.missionIds?.includes(mission.id)) throw new Error(`Mission ${mission.id} is not listed in campaign ${mission.campaignId}`);
  });

  data.nations.forEach((nation) => {
    if (!submarineIds.has(nation.starterSubmarineId)) {
      throw new Error(`Nation ${nation.id} references missing starter submarine ${nation.starterSubmarineId}`);
    }
    const base = data.logistics.bases.find((item) => item.nationId === nation.id);
    if (!base) throw new Error(`Nation ${nation.id} has no logistics base`);
    if (!Array.isArray(data.logistics.ranks[nation.id]) || data.logistics.ranks[nation.id].length < 4) {
      throw new Error(`Nation ${nation.id} has invalid rank ladder`);
    }
    const theater = data.strategy.theaters.find((item) => item.nationId === nation.id);
    if (!theater) throw new Error(`Nation ${nation.id} has no strategic theater`);
    if (!data.strategy.convoyLanes.some((lane) => lane.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no convoy lane`);
    if (!data.strategy.intelNetworks.some((network) => network.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no intel network`);
  });
  data.submarines.forEach((submarine) => {
    if (!nationIds.has(submarine.nation)) throw new Error(`Submarine ${submarine.id} has invalid nation ${submarine.nation}`);
  });
  data.crew.forEach((member) => {
    if (!nationIds.has(member.nation)) throw new Error(`Crew ${member.id} has invalid nation ${member.nation}`);
  });
  validateMissionNavigation(data.missions);
}

export async function loadGameData() {
  const values = await Promise.all(Object.values(DATA_FILES).map(fetchJson));
  const [nations, submarines, crew, missionsRaw, campaigns, campaignDoctrines, logistics, strategy, upgrades, ptBR, en, es] = values;
  assertArray('nations', nations);
  assertArray('submarines', submarines);
  assertArray('crew', crew);
  assertArray('missions', missionsRaw);
  assertArray('campaigns', campaigns);
  assertArray('campaignDoctrines', campaignDoctrines);
  assertArray('upgrades', upgrades);
  if (!logistics || typeof logistics !== 'object') throw new Error('logistics must be an object');
  if (!strategy || typeof strategy !== 'object') throw new Error('strategy must be an object');

  const missions = missionsRaw.map((mission) => ({ ...mission, _baseStatus: mission.status }));
  const translations = { 'pt-BR': ptBR, en, es };
  validateTranslations(translations);

  const data = { nations, submarines, crew, missions, campaigns, campaignDoctrines, logistics, strategy, upgrades, translations };
  validateRelations(data);
  return data;
}
