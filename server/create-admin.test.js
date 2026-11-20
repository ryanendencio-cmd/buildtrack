const test = require('node:test')
const assert = require('node:assert/strict')
const { buildAdminProfile } = require('./create-admin')

test('requires explicit initial admin credentials', () => {
  assert.throws(() => buildAdminProfile({}), /ADMIN_USERNAME/)
})

test('validates password length and builds the administrator profile from supplied values', () => {
  const environment = {
    ADMIN_USERNAME: 'buildtrack-test-admin',
    ADMIN_PASSWORD: 'a secure test password',
    ADMIN_EMAIL: 'admin@example.test',
    ADMIN_FIRST_NAME: 'Test',
    ADMIN_MIDDLE_NAME: 'BuildTrack',
    ADMIN_LAST_NAME: 'Admin'
  }

  const profile = buildAdminProfile(environment)
  assert.equal(profile.role, 'Administrator')
  assert.equal(profile.full_name, 'Test BuildTrack Admin')
  assert.equal(profile.username, environment.ADMIN_USERNAME)
  assert.equal(profile.password, environment.ADMIN_PASSWORD)

  assert.throws(() => buildAdminProfile({
    ...environment,
    ADMIN_PASSWORD: 'short'
  }), /between 12 and 72 UTF-8 bytes/)
})
