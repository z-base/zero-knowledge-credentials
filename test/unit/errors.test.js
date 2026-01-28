import test from 'node:test'
import assert from 'node:assert/strict'
import { ZKCredentialError } from '../../dist/ZKCredentials/errors.js'

test('ZKCredentialError uses default message and code', () => {
  const error = new ZKCredentialError('unsupported')
  assert.equal(error.code, 'unsupported')
  assert.match(error.message, /zero-knowledge-credentials/)
  assert.match(error.message, /unsupported/)
})

test('ZKCredentialError accepts custom message', () => {
  const error = new ZKCredentialError('aborted', 'custom message')
  assert.equal(error.code, 'aborted')
  assert.equal(error.message, 'custom message')
})
