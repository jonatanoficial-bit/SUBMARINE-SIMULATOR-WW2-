import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderGameplay } from '../js/screens/gameplay.js';

const ROOT = path.normalize(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

test('guided tutorial stays outside station panels and exposes six ordered procedures', () => {
  const html = renderGameplay((key) => key, { id:'tutorial-de', tutorialMission:true, titleKey:'tutorialMission.lobbyTitle' }, { tutorials:false, difficulty:'cadet' });
  const guideIndex = html.indexOf('id="operational-guide"');
  const consoleIndex = html.indexOf('class="gameplay-console-grid"');
  assert.ok(guideIndex > 0 && guideIndex < consoleIndex);
  assert.match(html, /guided-mission-guide/);
  assert.doesNotMatch(html, /id="training-dismiss"/);
  for (const step of ['contact','sonar','approach','solution','attack','evade']) assert.match(html, new RegExp(`data-training-step="${step}"`));
});

test('combat room presents one active station and actionable alerts remain fixed', () => {
  const gameplay = readText('js/screens/gameplay.js');
  const css = readText('css/tutorial-station-focus.css');
  const index = readText('index.html');
  assert.match(gameplay, /data-active-station/);
  assert.match(gameplay, /panel\.hidden = !selected/);
  assert.doesNotMatch(gameplay, /command-room-ribbon-grid/);
  assert.match(css, /phase27-alert-atmosphere\[data-alert-level="calm"\]/);
  assert.match(css, /position:\s*sticky/);
  assert.match(index, /tutorial-station-focus\.css/);
});

test('tutorial interface keys exist in every supported language', () => {
  const keys = [
    'tutorialMission.lobbyTitle', 'tutorialMission.lobbyDesc', 'tutorialMission.ready',
    'training.activeStation', 'training.instruction.contact', 'training.instruction.sonar',
    'training.instruction.approach', 'training.instruction.solution',
    'training.instruction.attack', 'training.instruction.evade', 'training.guideComplete',
  ];
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    for (const key of keys) assert.ok(dictionary[key], `${lang} missing ${key}`);
  }
});

test('captain choices expose manual control, crew delegation and a consequence preview', () => {
  const gameplay = readText('js/screens/gameplay.js');
  assert.match(gameplay, /id="delegation-auto"/);
  assert.match(gameplay, /id="delegation-manual"/);
  assert.match(gameplay, /id="delegation-consequence"/);
  for (const lang of ['pt-BR','en','es']) {
    const dictionary = readJson(`data/translations/${lang}.json`);
    assert.ok(dictionary['delegation.action.autoRepair']);
    assert.ok(dictionary['delegation.action.manualDamage']);
    assert.ok(dictionary['delegation.consequence.damage']);
    assert.ok(dictionary['delegation.consequence.attack-ready']);
  }
});
