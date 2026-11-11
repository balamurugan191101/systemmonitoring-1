const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, normalizeLogin, validPassword, mayViewComputer, mayAdministerUsers, mayReviewAudit } = require('../server/security-policy');

test('defines the four supported server roles', () => assert.deepEqual(ROLES, ['Super Admin', 'Admin', 'IT Engineer', 'Viewer']));
test('normalizes login identifiers', () => assert.equal(normalizeLogin('  ADMIN@Example.com '), 'admin@example.com'));
test('requires strong passwords', () => {
  assert.equal(validPassword('LongEnough123'), true);
  assert.equal(validPassword('short1A'), false);
  assert.equal(validPassword('alllowercase123'), false);
});
test('grants Super Admin system scope and other roles only explicit grants', () => {
  for (const role of ROLES.slice(1)) {
    assert.equal(mayViewComputer(role, ['local'], 'local'), true);
    assert.equal(mayViewComputer(role, ['local'], 'other'), false);
  }
  assert.equal(mayViewComputer('Super Admin', [], 'other'), true);
  assert.equal(mayViewComputer('forged-role', ['other'], 'other'), false);
});
test('reserves user administration and audit review for Super Admin', () => {
  assert.equal(mayAdministerUsers('Super Admin'), true);
  assert.equal(mayReviewAudit('Super Admin'), true);
  for (const role of ROLES.slice(1)) {
    assert.equal(mayAdministerUsers(role), false);
    assert.equal(mayReviewAudit(role), false);
  }
});
