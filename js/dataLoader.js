async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

export async function loadGameData() {
  const [nations, submarines, crew, missions, ptBR, en, es] = await Promise.all([
    loadJson('./data/nations.json'),
    loadJson('./data/submarines.json'),
    loadJson('./data/crew.json'),
    loadJson('./data/missions.json'),
    loadJson('./data/translations/pt-BR.json'),
    loadJson('./data/translations/en.json'),
    loadJson('./data/translations/es.json')
  ]);

  return {
    nations,
    submarines,
    crew,
    missions,
    translations: {
      'pt-BR': ptBR,
      en,
      es
    }
  };
}
