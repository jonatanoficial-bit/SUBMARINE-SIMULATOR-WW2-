export async function loadGameData() {
  const [nations, submarines, crew, missions, upgrades, ptBR, en, es] = await Promise.all([
    fetch('data/nations.json').then((res) => res.json()),
    fetch('data/submarines.json').then((res) => res.json()),
    fetch('data/crew.json').then((res) => res.json()),
    fetch('data/missions.json').then((res) => res.json()),
    fetch('data/upgrades.json').then((res) => res.json()),
    fetch('data/translations/pt-BR.json').then((res) => res.json()),
    fetch('data/translations/en.json').then((res) => res.json()),
    fetch('data/translations/es.json').then((res) => res.json())
  ]);

  return {
    nations,
    submarines,
    crew,
    missions,
    upgrades,
    translations: {
      'pt-BR': ptBR,
      en,
      es
    }
  };
}
