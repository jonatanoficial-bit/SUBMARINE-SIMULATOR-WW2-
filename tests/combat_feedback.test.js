import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTorpedoOutcomeFeedback, buildTorpedoRunFeedback } from '../js/systems/combatFeedback.js';
import { buildTacticalNavalChartView } from '../js/systems/tacticalNavalChart.js';
import { renderGameplay } from '../js/screens/gameplay.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const readJson = (path) => JSON.parse(read(path));

test('torpedo run exposes time and progress while a shot is active', () => {
  const view = buildTorpedoRunFeedback({ torpedoActive:true, weapons:{ activeShots:[{ remainingMs:4000, travelMs:10000 }] } });
  assert.equal(view.active, true);
  assert.equal(view.remainingSeconds, 4);
  assert.equal(view.progress, 60);
});

test('hit and failure outcomes produce distinct officer reports and consequences', () => {
  const hit = buildTorpedoOutcomeFeedback({ hit:true, outcome:'hit', targetRole:'target' });
  assert.equal(hit.titleKey, 'combatFeedback.title.hitTarget');
  assert.equal(hit.markerState, 'eliminated');
  assert.equal(hit.primaryKey, 'combatFeedback.action.evade');
  const dud = buildTorpedoOutcomeFeedback({ hit:false, outcome:'dud', targetRole:'target' });
  assert.equal(dud.titleKey, 'combatFeedback.title.dud');
  assert.equal(dud.primaryKey, 'combatFeedback.action.retry');
});

test('naval chart keeps destroyed ships and marks them eliminated', () => {
  const chart = buildTacticalNavalChartView({ snapshot:{ navigation:{ position:{lat:48,lon:-15} }, navalAI:{ ships:[
    { id:'merchant-1', role:'target', shipType:'merchant', x:220, y:10, active:false, destroyed:true },
    { id:'escort-1', role:'escort', shipType:'destroyer', x:300, y:30, active:true, destroyed:false },
  ] } } });
  assert.equal(chart.contactMarkers.length, 2);
  assert.equal(chart.contactMarkers[0].destroyed, true);
  assert.equal(chart.contactMarkers[0].labelKey, 'combatFeedback.map.eliminated');
});

test('gameplay ships cinematic impact report, torpedo timer and manual decisions', () => {
  const html = renderGameplay((key) => key, { id:'feedback-test' }, { voices:true });
  assert.match(html, /id="combat-impact-feedback"/);
  assert.match(html, /id="torpedo-run-status"/);
  assert.match(html, /id="combat-impact-map"/);
  assert.match(html, /ocean_explosion_01\.png/);
  const css = read('css/phase56-combat-feedback.css');
  assert.match(css, /phase56-ship-hit/);
  assert.match(css, /phase56-chart-contact\.eliminated/);
  const audio = read('js/audio.js');
  assert.match(audio, /speakOfficerLine/);
  assert.match(audio, /shipImpact/);
});

test('combat voice and result keys exist in every language', () => {
  for (const lang of ['pt-BR','en','es']) {
    const dict = readJson(`data/translations/${lang}.json`);
    for (const key of [
      'settings.voices', 'combatFeedback.voice.fired', 'combatFeedback.voice.hitTarget',
      'combatFeedback.voice.miss', 'combatFeedback.summary.hitTarget',
      'combatFeedback.consequence.hitTarget', 'combatFeedback.map.eliminated',
    ]) assert.ok(dict[key], `${lang} missing ${key}`);
  }
});
