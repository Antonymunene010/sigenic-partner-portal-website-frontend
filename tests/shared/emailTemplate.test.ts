import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderString } from '../../shared/emailTemplate'

// Pin the public placeholder syntax + filter contract. The same renderString
// runs in the admin editor preview AND on the server at send-time, so any
// drift here ships visibly broken templates.

test('renderString — bare placeholder substitutes the value', () => {
  assert.equal(renderString('Hi {{name}}', { name: 'Wei' }), 'Hi Wei')
})

test('renderString — unknown variable collapses to empty string', () => {
  assert.equal(renderString('Hi {{missing}}!', {}), 'Hi !')
})

test('renderString — surrounding whitespace inside the braces is tolerated', () => {
  assert.equal(renderString('{{  name  }}', { name: 'Wei' }), 'Wei')
})

test('renderString — |upper / |lower / |capitalize apply the documented filter', () => {
  // capitalize is tested with an all-caps input so the assertion also pins the
  // "lowercase the tail" behaviour — a naïve `charAt(0).toUpperCase() + slice(1)`
  // would leave 'CREATED' unchanged and fail here.
  assert.equal(renderString('{{action|upper}}', { action: 'created' }), 'CREATED')
  assert.equal(renderString('{{action|lower}}', { action: 'CREATED' }), 'created')
  assert.equal(renderString('{{action|capitalize}}', { action: 'CREATED' }), 'Created')
})

test('renderString — capitalize on empty value stays empty (no crash on charAt)', () => {
  assert.equal(renderString('{{action|capitalize}}', { action: '' }), '')
})

test('renderString — unknown filter degrades to the raw value (typo never blanks the field)', () => {
  assert.equal(renderString('{{action|uper}}', { action: 'created' }), 'created')
})

test('renderString — whitespace around the pipe is tolerated', () => {
  assert.equal(renderString('{{ action | upper }}', { action: 'created' }), 'CREATED')
})

test('renderString — multiple placeholders with mixed filters render independently', () => {
  assert.equal(
    renderString('{{action|capitalize}} by {{actor|upper}}', { action: 'created', actor: 'priya' }),
    'Created by PRIYA',
  )
})
