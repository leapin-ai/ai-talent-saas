const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const servicePath = path.join(__dirname, '../../libs/services/talentReview.js');
const source = fs.readFileSync(servicePath, 'utf8');

test('talent-saas invite path calls the OpenAPI endpoints the UI depends on', () => {
  const expected = ['project/org/batch-add', 'project/org/batch-invite', 'project/manual-score-invite-preview-batch', 'project/manual-score-invite-send-batch', 'project/manual-score-invite-save-batch', 'project/manual-score-invite-resend'];
  expected.forEach(pathname => {
    assert.match(source, new RegExp(pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing call to ${pathname}`);
  });
});

test('evaluator roles include independent hr without renaming subordinate', () => {
  assert.match(source, /MANUAL_ROLES = \['superior', 'peer', 'subordinate', 'hr'\]/);
  assert.doesNotMatch(source, /subordinate.*===.*hr|hr.*=.*subordinate/);
});
