'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('browser fallback creates a clearly labelled capsule without browser APIs', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'fallback.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(script, context);
  const result = context.window.PausePointFallback.makeFallback({
    projectName: 'A sample repo', goal: 'Fix JSON parsing', changed: 'Added an output schema',
    verified: 'Unit tests pass', unverified: 'Manual browser test not done', blocker: 'Malformed input still needs checking'
  });
  assert.equal(result.mode, 'template');
  assert.match(result.notice, /hosted preview|local API/i);
  assert.match(result.capsule.workingOn, /Fix JSON parsing/);
  assert.match(result.capsule.verified.join(' '), /Unit tests pass/);
  assert.match(result.capsule.unverified.join(' '), /Manual browser test not done/);
  assert.ok(result.capsule.nextSteps.length > 0);
});
