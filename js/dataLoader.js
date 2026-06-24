const DATA_FILES = {
  nations: 'data/nations.json',
  submarines: 'data/submarines.json',
  crew: 'data/crew.json',
  missions: 'data/missions.json',
  campaigns: 'data/campaigns.json',
  campaignDoctrines: 'data/campaign_doctrines.json',
  campaignObjectives: 'data/campaign_objectives.json',
  campaignConsequences: 'data/campaign_consequences.json',
  highCommandOrders: 'data/high_command_orders.json',
  campaignEvents: 'data/campaign_events.json',
  specialOperations: 'data/special_operations.json',
  operationChains: 'data/operation_chains.json',
  operationOutcomes: 'data/operation_outcomes.json',
  operationalHonors: 'data/operational_honors.json',
  commandAdvancement: 'data/command_advancement.json',
  veteranOfficers: 'data/veteran_officers.json',
  crewDrills: 'data/crew_drills.json',
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
  const objectiveSetIds = assertUniqueIds('campaignObjectives', data.campaignObjectives || []);
  const consequenceSetIds = assertUniqueIds('campaignConsequences', data.campaignConsequences || []);
  const highCommandSetIds = assertUniqueIds('highCommandOrders', data.highCommandOrders || []);
  const campaignEventSetIds = assertUniqueIds('campaignEvents', data.campaignEvents || []);
  const specialOperationSetIds = assertUniqueIds('specialOperations', data.specialOperations || []);
  const operationChainSetIds = assertUniqueIds('operationChains', data.operationChains || []);
  const operationOutcomeSetIds = assertUniqueIds('operationOutcomes', data.operationOutcomes || []);
  const operationalHonorSetIds = assertUniqueIds('operationalHonors', data.operationalHonors || []);
  const commandAdvancementSetIds = assertUniqueIds('commandAdvancement', data.commandAdvancement || []);
  const veteranOfficerSetIds = assertUniqueIds('veteranOfficers', data.veteranOfficers || []);
  const crewDrillSetIds = assertUniqueIds('crewDrills', data.crewDrills || []);
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

if ((data.campaignObjectives || []).length !== data.nations.length) throw new Error('Campaign objectives must cover every nation');
data.campaignObjectives.forEach((objectiveSet) => {
  if (!nationIds.has(objectiveSet.nationId)) throw new Error(`Campaign objective set ${objectiveSet.id} has invalid nation ${objectiveSet.nationId}`);
  if (!Array.isArray(objectiveSet.objectives) || objectiveSet.objectives.length !== 4) throw new Error(`Campaign objective set ${objectiveSet.id} must have four act objectives`);
  const nestedIds = new Set();
  objectiveSet.objectives.forEach((objective) => {
    if (!objective?.id || nestedIds.has(objective.id)) throw new Error(`Campaign objective set ${objectiveSet.id} has invalid or duplicate objective id`);
    nestedIds.add(objective.id);
    if (!Array.isArray(objective.missionIds) || objective.missionIds.length < 1) throw new Error(`Campaign objective ${objective.id} has no mission ids`);
    objective.missionIds.forEach((missionId) => {
      if (!missionIds.has(missionId)) throw new Error(`Campaign objective ${objective.id} references missing mission ${missionId}`);
    });
    const reward = objective.reward || {};
    ['credits','xp','commandPoints','reputation','prestige','intel','pressureRelief'].forEach((key) => {
      if (!Number.isFinite(Number(reward[key]))) throw new Error(`Campaign objective ${objective.id} missing numeric reward ${key}`);
    });
  });
});
data.nations.forEach((nation) => {
  if (!data.campaignObjectives.some((objectiveSet) => objectiveSet.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no campaign objectives`);
});


  if ((data.campaignConsequences || []).length !== data.nations.length) throw new Error('Campaign consequences must cover every nation');
  data.campaignConsequences.forEach((consequence) => {
    if (!nationIds.has(consequence.nationId)) throw new Error(`Campaign consequence set ${consequence.id} has invalid nation ${consequence.nationId}`);
    if (!Array.isArray(consequence.tracks) || consequence.tracks.length < 4) throw new Error(`Campaign consequence set ${consequence.id} needs four strategic tracks`);
    if (!Array.isArray(consequence.milestones) || consequence.milestones.length < 4) throw new Error(`Campaign consequence set ${consequence.id} needs four milestones`);
    consequence.tracks.forEach((track) => {
      ['base','perMission','perObjective','max'].forEach((key) => {
        if (!Number.isFinite(Number(track[key]))) throw new Error(`Campaign consequence track ${track.id} missing numeric ${key}`);
      });
    });
    consequence.milestones.forEach((milestone) => {
      if (!Number.isFinite(Number(milestone.threshold))) throw new Error(`Campaign consequence milestone in ${consequence.id} has invalid threshold`);
      const effect = milestone.effect || {};
      ['riskDelta','intelBonus','readinessBonus','tonnageMultiplier'].forEach((key) => {
        if (!Number.isFinite(Number(effect[key]))) throw new Error(`Campaign consequence milestone in ${consequence.id} missing numeric effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.campaignConsequences.some((consequence) => consequence.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no campaign consequence deck`);
  });

  if ((data.highCommandOrders || []).length !== data.nations.length) throw new Error('High command orders must cover every nation');
  data.highCommandOrders.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`High command deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.orders) || deck.orders.length < 4) throw new Error(`High command deck ${deck.id} needs at least four orders`);
    const nestedOrderIds = new Set();
    deck.orders.forEach((order) => {
      if (!order?.id || nestedOrderIds.has(order.id)) throw new Error(`High command deck ${deck.id} has invalid or duplicate order id`);
      nestedOrderIds.add(order.id);
      ['credits','commandPoints'].forEach((key) => {
        if (!Number.isFinite(Number(order.cost?.[key]))) throw new Error(`High command order ${order.id} missing cost ${key}`);
      });
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        if (!Number.isFinite(Number(order.effect?.[key]))) throw new Error(`High command order ${order.id} missing numeric effect ${key}`);
      });
      if (!Number.isFinite(Number(order.requires?.completedMissions))) throw new Error(`High command order ${order.id} missing completed mission requirement`);
    });
  });
  data.nations.forEach((nation) => {
    if (!data.highCommandOrders.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no high command deck`);
  });

  if ((data.campaignEvents || []).length !== data.nations.length) throw new Error('Campaign dynamic events must cover every nation');
  const validOrderIds = new Set((data.highCommandOrders || []).flatMap((deck) => (deck.orders || []).map((order) => order.id)));
  data.campaignEvents.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Campaign event deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.events) || deck.events.length < 5) throw new Error(`Campaign event deck ${deck.id} needs at least five dynamic events`);
    const nestedEventIds = new Set();
    deck.events.forEach((event) => {
      if (!event?.id || nestedEventIds.has(event.id)) throw new Error(`Campaign event deck ${deck.id} has invalid or duplicate event id`);
      nestedEventIds.add(event.id);
      const trigger = event.trigger || {};
      ['completedMissionsMin','completedMissionsMax','pressureMin','pressureMax','intelMin','decryptionMin'].forEach((key) => {
        if (key in trigger && !Number.isFinite(Number(trigger[key]))) throw new Error(`Campaign event ${event.id} has invalid trigger ${key}`);
      });
      if (trigger.activeOrderId && !validOrderIds.has(trigger.activeOrderId)) throw new Error(`Campaign event ${event.id} references missing high command order ${trigger.activeOrderId}`);
      ['intelBonus','decryptionBonus','pressureDelta','riskDelta','readinessBonus','tonnageMultiplier','moraleDelta','fatigueDelta'].forEach((key) => {
        if (!Number.isFinite(Number(event.effect?.[key]))) throw new Error(`Campaign event ${event.id} missing numeric effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.campaignEvents.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no dynamic event deck`);
  });


  if ((data.specialOperations || []).length !== data.nations.length) throw new Error('Special operations must cover every nation');
  const validEventIds = new Set((data.campaignEvents || []).flatMap((deck) => (deck.events || []).map((event) => event.id)));
  data.specialOperations.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Special operation deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.operations) || deck.operations.length < 4) throw new Error(`Special operation deck ${deck.id} needs at least four operations`);
    const nestedOperationIds = new Set();
    deck.operations.forEach((operation) => {
      if (!operation?.id || nestedOperationIds.has(operation.id)) throw new Error(`Special operation deck ${deck.id} has invalid or duplicate operation id`);
      nestedOperationIds.add(operation.id);
      ['credits','commandPoints'].forEach((key) => {
        if (!Number.isFinite(Number(operation.cost?.[key]))) throw new Error(`Special operation ${operation.id} missing cost ${key}`);
      });
      const requires = operation.requires || {};
      ['completedMissions','pressureMin','intelMin','decryptionMin'].forEach((key) => {
        if (key in requires && !Number.isFinite(Number(requires[key]))) throw new Error(`Special operation ${operation.id} has invalid requirement ${key}`);
      });
      if (requires.activeEventId && !validEventIds.has(requires.activeEventId)) throw new Error(`Special operation ${operation.id} references missing event ${requires.activeEventId}`);
      if (requires.activeOrderId && !validOrderIds.has(requires.activeOrderId)) throw new Error(`Special operation ${operation.id} references missing order ${requires.activeOrderId}`);
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        if (!Number.isFinite(Number(operation.effect?.[key]))) throw new Error(`Special operation ${operation.id} missing numeric effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.specialOperations.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no special operation deck`);
  });


  if ((data.operationChains || []).length !== data.nations.length) throw new Error('Operation chains must cover every nation');
  const validOperationIds = new Set((data.specialOperations || []).flatMap((deck) => (deck.operations || []).map((operation) => operation.id)));
  data.operationChains.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Operation chain deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.steps) || deck.steps.length !== 4) throw new Error(`Operation chain deck ${deck.id} must have four chained steps`);
    const nestedStepIds = new Set();
    deck.steps.forEach((step) => {
      if (!step?.id || nestedStepIds.has(step.id)) throw new Error(`Operation chain deck ${deck.id} has invalid or duplicate step id`);
      nestedStepIds.add(step.id);
      ['credits','commandPoints'].forEach((key) => {
        if (!Number.isFinite(Number(step.cost?.[key]))) throw new Error(`Operation chain step ${step.id} missing cost ${key}`);
      });
      const requires = step.requires || {};
      ['completedMissions','pressureMin','intelMin','decryptionMin'].forEach((key) => {
        if (key in requires && !Number.isFinite(Number(requires[key]))) throw new Error(`Operation chain step ${step.id} has invalid requirement ${key}`);
      });
      if (requires.previousStepId && !nestedStepIds.has(requires.previousStepId)) throw new Error(`Operation chain step ${step.id} references a previous step that is not earlier in the same chain`);
      if (requires.launchedOperationId && !validOperationIds.has(requires.launchedOperationId)) throw new Error(`Operation chain step ${step.id} references missing special operation ${requires.launchedOperationId}`);
      if (requires.activeEventId && !validEventIds.has(requires.activeEventId)) throw new Error(`Operation chain step ${step.id} references missing event ${requires.activeEventId}`);
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        if (!Number.isFinite(Number(step.effect?.[key]))) throw new Error(`Operation chain step ${step.id} missing numeric effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.operationChains.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no operation chain deck`);
  });


  if ((data.operationOutcomes || []).length !== data.nations.length) throw new Error('Operation outcomes must cover every nation');
  const validChainStepIds = new Set((data.operationChains || []).flatMap((deck) => (deck.steps || []).map((step) => step.id)));
  data.operationOutcomes.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Operation outcome deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.outcomes) || deck.outcomes.length !== 3) throw new Error(`Operation outcome deck ${deck.id} must have three strategic outcomes`);
    const requires = deck.requires || {};
    ['completedSteps','completedMissions'].forEach((key) => {
      if (!Number.isFinite(Number(requires[key]))) throw new Error(`Operation outcome deck ${deck.id} missing numeric requirement ${key}`);
    });
    if (!Array.isArray(requires.stepIds) || requires.stepIds.length !== 4) throw new Error(`Operation outcome deck ${deck.id} must require four chain steps`);
    requires.stepIds.forEach((stepId) => {
      if (!validChainStepIds.has(stepId)) throw new Error(`Operation outcome deck ${deck.id} references missing chain step ${stepId}`);
    });
    const nestedOutcomeIds = new Set();
    deck.outcomes.forEach((outcome) => {
      if (!outcome?.id || nestedOutcomeIds.has(outcome.id)) throw new Error(`Operation outcome deck ${deck.id} has invalid or duplicate outcome id`);
      nestedOutcomeIds.add(outcome.id);
      ['credits','commandPoints'].forEach((key) => {
        if (!Number.isFinite(Number(outcome.cost?.[key]))) throw new Error(`Operation outcome ${outcome.id} missing cost ${key}`);
      });
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        if (!Number.isFinite(Number(outcome.effect?.[key]))) throw new Error(`Operation outcome ${outcome.id} missing numeric effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.operationOutcomes.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no operation outcome deck`);
  });


  if ((data.operationalHonors || []).length !== data.nations.length) throw new Error('Operational honors must cover every nation');
  const validOutcomeIds = new Set((data.operationOutcomes || []).flatMap((deck) => (deck.outcomes || []).map((outcome) => outcome.id)));
  const validHonorOperationIds = new Set((data.specialOperations || []).flatMap((deck) => (deck.operations || []).map((operation) => operation.id)));
  const validHonorStepIds = new Set((data.operationChains || []).flatMap((deck) => (deck.steps || []).map((step) => step.id)));
  data.operationalHonors.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Operational honor deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.honors) || deck.honors.length !== 5) throw new Error(`Operational honor deck ${deck.id} must have five honors`);
    const nestedHonorIds = new Set();
    deck.honors.forEach((honor) => {
      if (!honor?.id || nestedHonorIds.has(honor.id)) throw new Error(`Operational honor deck ${deck.id} has invalid or duplicate honor id`);
      nestedHonorIds.add(honor.id);
      if (!Number.isFinite(Number(honor.tier))) throw new Error(`Operational honor ${honor.id} missing numeric tier`);
      const requires = honor.requires || {};
      ['completedMissions','tonnageMin','reputationMin','prestigeMin','intelMin'].forEach((key) => {
        if (key in requires && !Number.isFinite(Number(requires[key]))) throw new Error(`Operational honor ${honor.id} has invalid requirement ${key}`);
      });
      if (requires.launchedOperationId && !validHonorOperationIds.has(requires.launchedOperationId)) throw new Error(`Operational honor ${honor.id} references missing special operation ${requires.launchedOperationId}`);
      if (requires.completedStepId && !validHonorStepIds.has(requires.completedStepId)) throw new Error(`Operational honor ${honor.id} references missing chain step ${requires.completedStepId}`);
      if (requires.chosenOutcomeId && !validOutcomeIds.has(requires.chosenOutcomeId)) throw new Error(`Operational honor ${honor.id} references missing outcome ${requires.chosenOutcomeId}`);
      ['credits','xp','commandPoints','reputation','prestige','intelBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        if (!Number.isFinite(Number(honor.reward?.[key]))) throw new Error(`Operational honor ${honor.id} missing reward ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.operationalHonors.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no operational honor deck`);
  });

  if ((data.commandAdvancement || []).length !== data.nations.length) throw new Error('Command advancement must cover every nation');
  const advancementOutcomeIds = new Set((data.operationOutcomes || []).flatMap((deck) => (deck.outcomes || []).map((outcome) => outcome.id)));
  const advancementStepIds = new Set((data.operationChains || []).flatMap((deck) => (deck.steps || []).map((step) => step.id)));
  data.commandAdvancement.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Command advancement deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.ranks) || deck.ranks.length !== 5) throw new Error(`Command advancement deck ${deck.id} must have five rank milestones`);
    const nestedRankIds = new Set();
    deck.ranks.forEach((rank) => {
      if (!rank?.id || nestedRankIds.has(rank.id)) throw new Error(`Command advancement deck ${deck.id} has invalid or duplicate rank id`);
      nestedRankIds.add(rank.id);
      if (!Number.isFinite(Number(rank.rankIndex))) throw new Error(`Command advancement ${rank.id} missing rankIndex`);
      const requires = rank.requires || {};
      ['reputationMin','prestigeMin','completedMissions','tonnageMin','awardedHonors','intelMin'].forEach((key) => {
        if (key in requires && !Number.isFinite(Number(requires[key]))) throw new Error(`Command advancement ${rank.id} has invalid requirement ${key}`);
      });
      if (requires.completedStepId && !advancementStepIds.has(requires.completedStepId)) throw new Error(`Command advancement ${rank.id} references missing chain step ${requires.completedStepId}`);
      if (requires.chosenOutcomeId && !advancementOutcomeIds.has(requires.chosenOutcomeId)) throw new Error(`Command advancement ${rank.id} references missing outcome ${requires.chosenOutcomeId}`);
      ['credits','xp','commandPoints','prestige'].forEach((key) => {
        if (!Number.isFinite(Number(rank.reward?.[key]))) throw new Error(`Command advancement ${rank.id} missing reward ${key}`);
      });
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta'].forEach((key) => {
        if (!Number.isFinite(Number(rank.effect?.[key]))) throw new Error(`Command advancement ${rank.id} missing effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.commandAdvancement.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no command advancement deck`);
  });


  if ((data.veteranOfficers || []).length !== data.nations.length) throw new Error('Veteran officers must cover every nation');
  data.veteranOfficers.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Veteran officer deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.officers) || deck.officers.length !== 4) throw new Error(`Veteran officer deck ${deck.id} must have four specialists`);
    const nestedOfficerIds = new Set();
    deck.officers.forEach((officer) => {
      if (!officer?.id || nestedOfficerIds.has(officer.id)) throw new Error(`Veteran officer deck ${deck.id} has invalid or duplicate officer id`);
      nestedOfficerIds.add(officer.id);
      ['credits','commandPoints'].forEach((key) => {
        if (!Number.isFinite(Number(officer.cost?.[key]))) throw new Error(`Veteran officer ${officer.id} missing cost ${key}`);
      });
      const requires = officer.requires || {};
      ['completedMissions','reputationMin','rankIndexMin','awardedHonors','claimedPromotions'].forEach((key) => {
        if (key in requires && !Number.isFinite(Number(requires[key]))) throw new Error(`Veteran officer ${officer.id} has invalid requirement ${key}`);
      });
      ['intelBonus','decryptionBonus','pressureRelief','riskDelta','readinessBonus','tonnageMultiplier','moraleBonus','fatigueDelta','sonarBonus','engineeringBonus','torpedoBonus','stealthBonus'].forEach((key) => {
        if (!Number.isFinite(Number(officer.effect?.[key]))) throw new Error(`Veteran officer ${officer.id} missing effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.veteranOfficers.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no veteran officer deck`);
  });



  if ((data.crewDrills || []).length !== data.nations.length) throw new Error('Crew drills must cover every nation');
  data.crewDrills.forEach((deck) => {
    if (!nationIds.has(deck.nationId)) throw new Error(`Crew drill deck ${deck.id} has invalid nation ${deck.nationId}`);
    if (!Array.isArray(deck.drills) || deck.drills.length !== 4) throw new Error(`Crew drill deck ${deck.id} must have four drills`);
    const nestedDrillIds = new Set();
    deck.drills.forEach((drill) => {
      if (!drill?.id || nestedDrillIds.has(drill.id)) throw new Error(`Crew drill deck ${deck.id} has invalid or duplicate drill id`);
      nestedDrillIds.add(drill.id);
      ['credits','commandPoints'].forEach((key) => {
        if (!Number.isFinite(Number(drill.cost?.[key]))) throw new Error(`Crew drill ${drill.id} missing cost ${key}`);
      });
      const requires = drill.requires || {};
      ['completedMissions','assignedOfficers','readinessMin'].forEach((key) => {
        if (key in requires && !Number.isFinite(Number(requires[key]))) throw new Error(`Crew drill ${drill.id} has invalid requirement ${key}`);
      });
      ['readinessBonus','moraleBonus','fatigueDelta','sonarBonus','engineeringBonus','torpedoBonus','stealthBonus','intelBonus','decryptionBonus','pressureRelief','riskDelta','tonnageMultiplier'].forEach((key) => {
        if (!Number.isFinite(Number(drill.effect?.[key]))) throw new Error(`Crew drill ${drill.id} missing effect ${key}`);
      });
    });
  });
  data.nations.forEach((nation) => {
    if (!data.crewDrills.some((deck) => deck.nationId === nation.id)) throw new Error(`Nation ${nation.id} has no crew drill deck`);
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
  const [nations, submarines, crew, missionsRaw, campaigns, campaignDoctrines, campaignObjectives, campaignConsequences, highCommandOrders, campaignEvents, specialOperations, operationChains, operationOutcomes, operationalHonors, commandAdvancement, veteranOfficers, crewDrills, logistics, strategy, upgrades, ptBR, en, es] = values;
  assertArray('nations', nations);
  assertArray('submarines', submarines);
  assertArray('crew', crew);
  assertArray('missions', missionsRaw);
  assertArray('campaigns', campaigns);
  assertArray('campaignDoctrines', campaignDoctrines);
  assertArray('campaignObjectives', campaignObjectives);
  assertArray('campaignConsequences', campaignConsequences);
  assertArray('highCommandOrders', highCommandOrders);
  assertArray('campaignEvents', campaignEvents);
  assertArray('specialOperations', specialOperations);
  assertArray('operationChains', operationChains);
  assertArray('operationOutcomes', operationOutcomes);
  assertArray('operationalHonors', operationalHonors);
  assertArray('commandAdvancement', commandAdvancement);
  assertArray('veteranOfficers', veteranOfficers);
  assertArray('crewDrills', crewDrills);
  assertArray('upgrades', upgrades);
  if (!logistics || typeof logistics !== 'object') throw new Error('logistics must be an object');
  if (!strategy || typeof strategy !== 'object') throw new Error('strategy must be an object');

  const missions = missionsRaw.map((mission) => ({ ...mission, _baseStatus: mission.status }));
  const translations = { 'pt-BR': ptBR, en, es };
  validateTranslations(translations);

  const data = { nations, submarines, crew, missions, campaigns, campaignDoctrines, campaignObjectives, campaignConsequences, highCommandOrders, campaignEvents, specialOperations, operationChains, operationOutcomes, operationalHonors, commandAdvancement, veteranOfficers, crewDrills, logistics, strategy, upgrades, translations };
  validateRelations(data);
  return data;
}
