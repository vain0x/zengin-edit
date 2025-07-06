import { codeToString, convert, stringToCode } from 'encoding-japanese'

export function encodeJis(value: string): Uint8Array {
  return Uint8Array.from(convert(stringToCode(value), 'SJIS'))
}

export function decodeJis(input: Uint8Array): string {
  return codeToString(convert(input, 'UNICODE', 'SJIS'))
}

export function encodeEbcdic(value: string): Uint8Array {
  let output: number[] = []
  for (let i = 0; i < value.length; i++) {
    // Invalid characters are mapped to a underscore ('_') as replacement, which is invalid in Zengin character fields.
    const code = FujitsuEbcDic.inverse.get(value.charCodeAt(i)) || 0x6D
    output.push(code)
  }
  return Uint8Array.from(output)
}

export function decodeEbcdic(input: Uint8Array): string {
  let codePoints: number[] = []
  for (let i = 0; i < input.length; i++) {
    // Invalid characters are mapped to a special character U+FFFD (replacement).
    const cp = FujitsuEbcDic.mapping[input[i]] || 0xFFFD
    codePoints.push(cp)
  }
  return String.fromCodePoint(...codePoints)
}

// Fujitsu's EBCDIC
// https://en.wikipedia.org/wiki/Japanese_language_in_EBCDIC
const FujitsuEbcDic = ((): {
  /** Mapping from EBCDIC character code to Unicode code point */
  mapping: number[]
  /** Mapping from Unicode code point to EBCDIC character code */
  inverse: Map<number, number>
} => {
  // Note: This table only contains a subset of valid characters in Zengin records.
  const table = `
    40 SP
    42 ｢
    43 ｣
    46 ｦ
    4B .
    4D (
    4E +
    5B \\
    5D )
    60 -
    61 /
    6B ,
    6F ?
    7A :
    7D '
    81 ｱｲｳｴｵｶｷｸｹｺ
    8C ｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ
    9D ﾊﾋﾌ
    A2 ﾍﾎﾏﾐﾑﾒﾓﾔﾕ
    AB ﾖﾗﾘﾙ
    BA ﾚﾛﾜﾝﾞﾟ
    C1 ABCDEFGHI
    D1 JKLMNOPQR
    E2 STUVWXYZ
    F0 0123456789`
  const mapping = [...new Array(0x100).keys()].map(() => 0)
  mapping[0x0D] = 0x0D // CR
  mapping[0x0A] = 0x0A // LF
  for (let line of table.split(/\r?\n/)) {
    line = line.trim()
    if (!line) continue

    const hex = Number.parseInt(line.slice(0, 2), 16)
    if (hex === 0x40) { // SP
      mapping[hex] = ' '.charCodeAt(0)
      continue
    }
    const chars = line.slice(3)
    for (let i = 0; i < chars.length; i++) {
      // console.log('EBCDIC', `0x${(hex + i).toString(16).padStart(2, '0')} -> '${chars[i]}'`)
      mapping[hex + i] = chars.charCodeAt(i)
    }
  }

  const inverse = new Map<number, number>()
  for (let h = 0; h < mapping.length; h++) {
    if (mapping[h]) {
      inverse.set(mapping[h], h)
    }
  }
  return { mapping, inverse }
})()
