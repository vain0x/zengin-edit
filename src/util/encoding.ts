import { convert, stringToCode, codeToString } from 'encoding-japanese'

export function encodeJis(value: string): Uint8Array {
  return Uint8Array.from(convert(stringToCode(value), 'SJIS'))
}

export function decodeJis(input: Uint8Array): string {
  return codeToString(convert(input, 'UNICODE', 'SJIS'))
}
