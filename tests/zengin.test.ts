import { deepEqual, deepStrictEqual, strictEqual } from 'node:assert'
import { describe, test } from 'vitest'
import { encodeJis } from '../src/util/encoding'
import { Result } from '../src/util/result'
import { type FieldDef, decodeDocument, encodeDocument, getRecordType, validateCharField, validateNumberField } from '../src/zengin'

const testData = `101John                                                                                                                 \r\n202John                                                                                                                 \r\n8                                                                                                                       \r\n9                                                                                                                       \r\n`

describe('decoding', () => {
  test('success', () => {
    const d = decodeDocument(encodeJis(testData))
    deepEqual(d.errors, [])
    strictEqual(d.rows.length, 4)
    strictEqual(d.rows[0][0], '1')
    strictEqual(d.rows[0][1], '01')
    strictEqual(d.rows[1][0], '2')
  })

  test('partial lines', () => {
    const partialLines = `1\r2\n8\r\n9\r\n`
    const decoded = decodeDocument(encodeJis(partialLines))
    strictEqual(decoded.rows.length, 4)
    deepStrictEqual(decoded.rows.map(r => r[0]), [...'1289'])
    deepStrictEqual(decoded.errors, [0, 1, 2, 3].map(i => ({ type: 'partial', rowIndex: i })))
  })

  test('no linebreaks', () => {
    // decode should work without linebreaks
    const decoded = decodeDocument(encodeJis(testData.replaceAll('\r\n', '')))
    strictEqual(decoded.rows.length, 4)
    deepStrictEqual(decoded.errors, [])
  })
})

test('encode', () => {
  const input = encodeJis(testData)
  const d = decodeDocument(input)
  const definition = d.rows.map(row => getRecordType(row))
  const encoded = encodeDocument(d.rows, definition)
  deepStrictEqual(encoded, input)
})

describe('validateNumberField', () => {
  const n1: FieldDef = { type: 'N', size: 1, name: 'type', display: 'N(1)' }
  const n3: FieldDef = { type: 'N', size: 3, name: 'type', display: 'N(3)' }

  test('ok', () => {
    strictEqual(validateNumberField('0', n1).type, 'ok')
    strictEqual(validateNumberField('9', n1).type, 'ok')
    strictEqual(validateNumberField('000', n3).type, 'ok')
    strictEqual(validateNumberField('042', n3).type, 'ok')
    strictEqual(validateNumberField('999', n3).type, 'ok')
  })
  test('longer', () => {
    strictEqual(validateNumberField('00', n1).type, 'error')
  })
  test('bad char report', () => {
    deepStrictEqual(validateNumberField('0x1', n3), Result.Error('invalid character at 1 (\'x\' U+0078)'))
  })
})

describe('validateCharField', () => {
  const c1: FieldDef = { type: 'C', size: 1, name: 'type', display: 'C(1)' }
  const c3: FieldDef = { type: 'C', size: 3, name: 'type', display: 'C(3)' }

  test('ok', () => {
    strictEqual(validateCharField(' ', c1).type, 'ok')
    strictEqual(validateCharField('ｲ', c1).type, 'ok')
    strictEqual(validateCharField('AtZ', c3).type, 'ok')
    strictEqual(validateCharField('ｱｲｳ', c3).type, 'ok')
  })
  test('longer', () => {
    strictEqual(validateCharField('ﾊﾞﾂﾄﾞ', c1).type, 'error')
  })
  test('bad char report', () => {
    deepStrictEqual(validateNumberField('0x1', c3), Result.Error('invalid character at 1 (\'x\' U+0078)'))
    // deepStrictEqual(validateCharField('\u2716', c3), Result.Error(''))
  })
})
