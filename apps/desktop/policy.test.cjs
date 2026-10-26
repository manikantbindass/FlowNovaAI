const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAppUrl, isRepositoryUrl } = require('./policy.cjs');
test('only the exact secure app origin can navigate inside the client', () => {
  assert.equal(isAppUrl('https://flownova-ai.vercel.app/app'), true);
  for (const url of ['http://flownova-ai.vercel.app/app', 'https://flownova-ai.vercel.app.attacker.test', 'https://attacker.test/?url=https://flownova-ai.vercel.app', 'file:///C:/Windows', 'javascript:alert(1)', 'https://user:password@flownova-ai.vercel.app', 'invalid']) {
    assert.equal(isAppUrl(url), false, url);
  }
});
test('external browser links are restricted to this repository', () => {
  assert.equal(isRepositoryUrl('https://github.com/manikantbindass/FlowNovaAI'), true);
  assert.equal(isRepositoryUrl('https://github.com/manikantbindass/FlowNovaAI/releases'), true);
  for (const url of ['https://github.com/manikantbindass/FlowNovaAI-malicious', 'https://github.com/other/repo', 'https://github.com.attacker.test/manikantbindass/FlowNovaAI', 'https://user@github.com/manikantbindass/FlowNovaAI', 'file:///test']) {
    assert.equal(isRepositoryUrl(url), false, url);
  }
});
