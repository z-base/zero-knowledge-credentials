import test from 'node:test'
import assert from 'node:assert/strict'
import { ZKCredentials } from '../../dist/index.js'

test('dist index exports ZKCredentials', () => {
  assert.equal(typeof ZKCredentials.registerCredential, 'function')
  assert.equal(typeof ZKCredentials.discoverCredential, 'function')
})
