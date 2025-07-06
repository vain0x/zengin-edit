import { deepEqual, deepStrictEqual, strictEqual } from 'node:assert'
import { describe, test } from 'vitest'
import { decodeEbcdic, encodeEbcdic, encodeJis } from '../src/util/encoding'
import { Result } from '../src/util/result'
import { type FieldDef, type TrailerRecord, computeResult, decodeDocument, encodeDocument, getRecordType, validateCharField, validateDocument, validateNumberField } from '../src/zengin'

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

describe('validate record type ordering', () => {
  // prints a character for each row, '.' for ok, 'x' for error
  function f(input: string): string {
    const decoded = decodeDocument(encodeJis(input))
    const error = validateDocument(decoded.rows).fieldErrors.map(row => row[0] ? 'x' : '.').join('')
    return error
  }

  test('empty', () => {
    strictEqual(f(''), '')
  })

  test('end-only', () => {
    strictEqual(f(''), '')
  })

  test('starts with non-header', () => {
    strictEqual(f('2\n'), 'x')
    strictEqual(f('8\n'), 'x')
  })

  test('duplicated header', () => {
    strictEqual(f('1\n1'), '.x')
    strictEqual(f('1\n2\n1\n'), '..x')
  })

  test('data after trailer', () => {
    strictEqual(f('1\n1'), '.x')
    strictEqual(f('1\n2\n1\n'), '..x')
  })

  test('missing trailer', () => {
    strictEqual(f('1\n2\n2'), '..x')
  })

  test('records after end', () => {
    strictEqual(f('9\n1'), '.x')
    strictEqual(f('9\n9'), '.x')
  })

  test('missing end', () => {
    strictEqual(f('1\n2\n2\n8'), '...x')
  })
})

describe('trailer amounts', () => {
  function f(input: { amount: string; resultCode: string }[][]): string[] {
    const def = getRecordType(['2'])! // data

    const table: string[][] = []
    for (const xs of input) {
      table.push(
        ['1'],
        ...xs.map(x => {
          return def.map(d => {
            switch (d.name) {
              case 'type': return '2'
              case 'amount': return x.amount
              case 'resultCode': return x.resultCode
              default: return '' // not used
            }
          })
        }),
        ['8'],
      )
    }
    const result = computeResult(table)
    return result.map(format)
  }

  const format = (s: TrailerRecord) => {
    return `total ${s.totalCount}=>${s.totalAmount}, transferred ${s.transferredCount}=>${s.transferredAmount}, failed ${s.failedCount}=>${s.failedAmount}`
  }

  test('all success', () => {
    deepStrictEqual(f([[
      { amount: '100', resultCode: '0' },
      { amount: '20', resultCode: '0' },
      { amount: '3', resultCode: '0' },
    ]]), [
      'total 3=>123, transferred 3=>123, failed 0=>0',
    ])
  })

  test('partial', () => {
    deepStrictEqual(f([[
      { amount: '1000', resultCode: '0' },
      { amount: '200', resultCode: '1' },
      { amount: '30', resultCode: '0' },
      { amount: '4', resultCode: '1' },
    ]]), [
      'total 4=>1234, transferred 2=>1030, failed 2=>204',
    ])
  })

  test('multiple headers', () => {
    deepStrictEqual(f([
      [{ amount: '1000', resultCode: '0' }],
      [{ amount: '2000', resultCode: '0' }],
    ]), [
      'total 1=>1000, transferred 1=>1000, failed 0=>0',
      'total 1=>2000, transferred 1=>2000, failed 0=>0',
    ])
  })
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
  const c99: FieldDef = { type: 'C', size: 99, name: 'type', display: 'C(99)' }

  test('ok', () => {
    strictEqual(validateCharField(' ', c1).type, 'ok')
    strictEqual(validateCharField('ｲ', c1).type, 'ok')
    strictEqual(validateCharField('ATZ', c3).type, 'ok')
    strictEqual(validateCharField('ｱｲｳ', c3).type, 'ok')
  })
  test('longer', () => {
    strictEqual(validateCharField('ﾊﾞﾂﾄﾞ', c1).type, 'error')
  })
  test('half-width ok', () => {
    const value = '｢｣ｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ'
    strictEqual(validateCharField(value, c99).type, 'ok')
    strictEqual(validateCharField('ﾃﾞﾎﾟｳﾞ', c99).type, 'ok')
  })
  test('bad', () => {
    strictEqual(validateCharField('ｧ', c3).type, 'error') // small half-width katakana A
    strictEqual(validateCharField('\n', c3).type, 'error')
  })
  test('bad char report', () => {
    deepStrictEqual(validateNumberField('0x1', c3), Result.Error('invalid character at 1 (\'x\' U+0078)'))
    deepStrictEqual(validateCharField('あ', c3), Result.Error('invalid character at 0 (\'あ\' U+3042)'))
  })
})

describe('mixed encoding', () => {
  const spaces = (n: number) => ' '.repeat(n)
  const zeros = (n: number) => '0'.repeat(n)

  const getTestData = () => {
    const header = '19110000000000ｼﾞﾖﾝ ﾄﾞｳ                                00000000               000               00000000                 \r\n'
    const trailer = '8' + zeros(54) + spaces(65) + '\r\n'
    const end = '9' + spaces(119) + '\r\n'
    strictEqual(header.length, 120 + 2) // +2 for CRLF
    strictEqual(trailer.length, 120 + 2)
    strictEqual(end.length, 120 + 2)

    const part1 = encodeJis(header + trailer) // codeType = 1 (JIS)
    const part2 = encodeEbcdic('1912' + header.slice(4) + trailer) // codeType = 2 (EBCDIC)
    const testData = new Uint8Array([...part1, ...part2, ...encodeJis(end)])
    return testData
  }

  test('decode', () => {
    const decoded = decodeDocument(getTestData())
    strictEqual(decoded.rows.length, 5) // 2 * (header + trailer) + end
    strictEqual(decoded.rows[0][4], 'ｼﾞﾖﾝ ﾄﾞｳ' + spaces(40 - 8)) // clientName
    strictEqual(decoded.rows[2][4], 'ｼﾞﾖﾝ ﾄﾞｳ' + spaces(40 - 8))
  })

  test('encode', () => {
    const testData = getTestData()
    const decoded = decodeDocument(testData)
    const encoded = encodeDocument(decoded.rows, decoded.rows.map(fields => getRecordType(fields)))
    deepEqual(encoded, testData)
  })
})

describe('ebcdic encoding', () => {
  const s = 'ｼﾞﾖﾝ ﾄﾞｳ'
  test.skip('roundtrip', () => {
    strictEqual(decodeEbcdic(encodeEbcdic(s)), s)
  })
  test('decode', () => {
    strictEqual(decodeEbcdic(new Uint8Array([0x40])), ' ')
    strictEqual(decodeEbcdic(new Uint8Array([0xC1, 0xC2, 0xC3])), 'ABC')
    strictEqual(decodeEbcdic(new Uint8Array([0x95, 0xBE])), 'ﾄﾞ')
  })
  test('encode', () => {
    deepEqual(encodeEbcdic(' '), new Uint8Array([0x40]))
    deepEqual(encodeEbcdic('ABC'), new Uint8Array([0xC1, 0xC2, 0xC3]))
    deepEqual(encodeEbcdic('ﾄﾞ'), new Uint8Array([0x95, 0xBE]))
  })
})
