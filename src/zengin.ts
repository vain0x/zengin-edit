import { decodeJis, encodeJis } from './util/encoding'
import { Result } from './util/result'

export const RecordTypes = {
  Header: 1,
  Data: 2,
  Trailer: 8,
  End: 9,
}

type Fields = string[]

export interface FieldDef {
  /** Data type (N: number, C: character) */
  type: 'N' | 'C'
  size: number
  name: string
  title: string
  /** UI type (default: text-field) */
  ui?: FieldUi
}

export type FieldUi = {
  type: 'text-field'
} | {
  type: 'select'
  options: { value: string; title: string }[]
}

const typeUi: FieldUi = {
  type: 'select',
  options: ([
    { value: RecordTypes.Header, title: 'ヘッダー' },
    { value: RecordTypes.Data, title: 'データ' },
    { value: RecordTypes.Trailer, title: 'トレイラー' },
    { value: RecordTypes.End, title: 'エンド' },
  ] satisfies { value: number; title: string }[]).map(option => {
    return { value: option.value.toString(), title: `${option.value}: ${option.title}` }
  })
}

const HeaderFieldDefs: FieldDef[] = [
  { type: 'N', size: 1, name: 'type', title: 'データ区分', ui: typeUi },
  { type: 'N', size: 2, name: 'shubetsuCode', title: '種別コード' },
  { type: 'N', size: 1, name: 'codeType', title: 'コード区分' },
  { type: 'N', size: 10, name: 'clientCode', title: '委託者コード' },
  { type: 'C', size: 40, name: 'clientName', title: '委託者名' },
  { type: 'N', size: 4, name: 'withdrawDate', title: '引落日' },
  { type: 'N', size: 4, name: 'bankCode', title: '取引銀行番号' },
  { type: 'C', size: 15, name: 'bankName', title: '取引銀行名' },
  { type: 'N', size: 3, name: 'branchCode', title: '取引支店番号' },
  { type: 'C', size: 15, name: 'branchName', title: '取引支店名' },
  { type: 'N', size: 1, name: 'clientAccountType', title: '預金種目(委託者)' },
  { type: 'N', size: 7, name: 'clientAccountNumber', title: '口座番号(委託者)' },
  { type: 'C', size: 17, name: 'dummy', title: 'ダミー' }
]

export const DataFieldDefs: FieldDef[] = [
  { type: 'N', size: 1, name: 'type', title: 'データ区分', ui: typeUi },
  { type: 'N', size: 4, name: 'payerBankCode', title: '引落銀行番号' },
  { type: 'C', size: 15, name: 'payerBankName', title: '引落銀行名' },
  { type: 'N', size: 3, name: 'payerBranchCode', title: '引落支店番号' },
  { type: 'C', size: 15, name: 'payerBranchName', title: '引落支店名' },
  { type: 'C', size: 4, name: 'dummy1', title: 'ダミー' },
  { type: 'N', size: 1, name: 'accountType', title: '預金種目' },
  { type: 'N', size: 7, name: 'accountNumber', title: '口座番号' },
  { type: 'C', size: 30, name: 'accountHolder', title: '預金者名' },
  { type: 'N', size: 10, name: 'amount', title: '引落金額' },
  { type: 'N', size: 1, name: 'newCode', title: '新規コード' },
  { type: 'N', size: 20, name: 'customerCode', title: '顧客番号' },
  { type: 'N', size: 1, name: 'resultCode', title: '振替結果コード' },
  { type: 'C', size: 8, name: 'dummy2', title: 'ダミー' }
]

export const TrailerFieldDefs: FieldDef[] = [
  { type: 'N', size: 1, name: 'type', title: 'データ区分', ui: typeUi },
  { type: 'N', size: 6, name: 'totalCount', title: '合計件数' },
  { type: 'N', size: 12, name: 'totalAmount', title: '合計金額' },
  { type: 'N', size: 6, name: 'transferredCount', title: '振替済件数' },
  { type: 'N', size: 12, name: 'transferredAmount', title: '振替済金額' },
  { type: 'N', size: 6, name: 'failedCount', title: '振替不能件数' },
  { type: 'N', size: 12, name: 'failedAmount', title: '振替不能金額' },
  { type: 'C', size: 65, name: 'dummy', title: 'ダミー' }
]

export const EndFieldDefs: FieldDef[] = [
  { type: 'N', size: 1, name: 'type', title: 'データ区分', ui: typeUi },
  { type: 'C', size: 119, name: 'dummy', title: 'ダミー' }
]

export const UnknownFieldDefs: FieldDef[] = [
  { type: 'N', size: 1, name: 'type', title: 'データ区分', ui: typeUi },
  { type: 'C', size: 119, name: 'unknown', title: '不明' }
]

export interface DecodeError {
  type: 'partial'
  rowIndex: number
}

export interface TableError {
  fieldErrors: string[][]
}

export function decodeDocument(input: Uint8Array): { rows: string[][], errors: DecodeError[] } {
  let rowIndex = 0
  const errors: DecodeError[] = []

  const rows: string[][] = []
  let index = 0

  function lookaheadLineBreak(): number {
    if (index + 2 <= input.length && input[index] === CR && input[index + 1] === LF) {
      return 2
    } else if (index + 1 <= input.length && (input[index] === LF || input[index] === CR)) {
      return 1
    }
    return 0
  }

  function atEnd(): boolean {
    const len = lookaheadLineBreak()
    return index + len === input.length
  }

  function nextRecord(): Uint8Array | null {
    if (atEnd()) {
      return null
    }

    let recordBytes: Uint8Array
    if (index + RECORD_LEN <= input.length) {
      recordBytes = input.slice(index, index + RECORD_LEN)
    } else {
      recordBytes = input.slice(index, input.length)
    }

    // Split by a linebreak if any.
    let crAt = recordBytes.indexOf(CR)
    if (crAt < 0) {
      crAt = recordBytes.length // sentinel
    }
    let lfAt = recordBytes.indexOf(LF)
    if (lfAt < 0) {
      lfAt = recordBytes.length // sentinel
    }
    const linebreak = Math.min(crAt, lfAt)
    if (linebreak < recordBytes.length) {
      recordBytes = input.slice(index, index + linebreak)
    }

    _assert(recordBytes.length <= RECORD_LEN)
    index += recordBytes.length
    index += lookaheadLineBreak()

    const isComplete = recordBytes.length === RECORD_LEN
    if (!isComplete) {
      recordBytes = Uint8Array.from([...recordBytes, ...encodeJis(' '.repeat(RECORD_LEN - recordBytes.length))])
      errors.push({ type: 'partial', rowIndex })
    }
    return recordBytes
  }

  while (index < input.length) {
    const recordBytes = nextRecord()
    if (!recordBytes) break

    const recordType = decodeAsciiDigit(recordBytes![0])
    const fieldDefs = isValidRecordType(recordType) ? recordTypeToFieldDefs(recordType) : UnknownFieldDefs
    const fields = decodeRecord(recordBytes!, fieldDefs)
    rows.push(fields)

    rowIndex++
  }

  _assert(atEnd())
  return { rows, errors }
}

function decodeRecord(record: Uint8Array, fieldDefs: FieldDef[]): string[] {
  _assert(record.length === RECORD_LEN)
  const fields: string[] = []
  let bi = 0 // byte index
  let fi = 0 // field index
  while (bi < record.length) {
    _assert(fi < fieldDefs.length)
    const f = fieldDefs[fi]
    const chunk = record.slice(bi, bi + f.size)
    const value = decodeJis(chunk) // TODO: EBCDIC
    fields.push(value)
    bi += f.size
    fi++
  }
  return fields
}

export function encodeDocument(table: string[][], tableDef: FieldDef[][], options?: EncodeDocumentOptions): Uint8Array {
  _assert(table.length === tableDef.length)
  const linebreak = (options?.linebreak ?? 'CRLF') === 'CRLF' ? [CR, LF] : []
  let out: number[] = []
  for (let i = 0; i < tableDef.length; i++) {
    const row = table[i], fieldDefs = tableDef[i]
    writeRecord(row, fieldDefs, out)
    out.push(...linebreak)
  }
  return Uint8Array.from(out)
}

export interface EncodeDocumentOptions {
  /** (defaults to CRLF) */
  linebreak?: 'CRLF' | 'none' | null
}

function writeRecord(fields: string[], fieldDefs: FieldDef[], out: number[]) {
  _assert(fields.length === fieldDefs.length)
  for (let fi = 0; fi < fieldDefs.length; fi++) {
    const f = fieldDefs[fi]
    let code = encodeJis(fields[fi]) // TODO: EBCDIC

    if (f.type === 'N') {
      if (code.byteLength > f.size) {
        code = code.slice(code.byteLength - f.size, code.byteLength) // truncate start
      } else if (code.byteLength < f.size) {
        code = Uint8Array.from([...encodeJis('0'.repeat(f.size - code.byteLength)), ...code]) // pad start
      }
    } else if (f.type === 'C') {
      if (code.byteLength > f.size) {
        code = code.slice(0, f.size) // truncate end
      } else if (code.byteLength < f.size) {
        code = Uint8Array.from([...code, ...encodeJis(' '.repeat(f.size - code.byteLength))]) // pad end
      }
    }
    out.push(...code)
  }
}

function isValidRecordType(recordType: number): boolean {
  return recordType === RecordTypes.Header
    || recordType === RecordTypes.Data
    || recordType === RecordTypes.Trailer
    || recordType === RecordTypes.End
}

function recordTypeToFieldDefs(recordType: number): FieldDef[] {
  if (recordType === RecordTypes.Header) {
    return HeaderFieldDefs
  } else if (recordType === RecordTypes.Data) {
    return DataFieldDefs
  } else if (recordType === RecordTypes.Trailer) {
    return TrailerFieldDefs
  } else if (recordType === RecordTypes.End) {
    return EndFieldDefs
  } else {
    throw new Error('Unknown record type')
  }
}

export function getRecordType(fields: string[]) {
  if (fields.length >= 1 && fields[0].length >= 1) {
    const n = +fields[0][0]
    if (isValidRecordType(n)) {
      return recordTypeToFieldDefs(n)
    }
  }
  return UnknownFieldDefs
}

const LF = 0x0A
const CR = 0x0D
const DIGIT_ZERO = 0x30 // '0'
const RECORD_LEN = 120

function decodeAsciiDigit(code: number): number {
  return code - DIGIT_ZERO
}

export function validateDocument(table: Fields[]): TableError {
  const errors: TableError = { fieldErrors: [] }
  for (const [rowIndex, fields] of table.entries()) {
    if (fields.length === 0) {
      // never?
      errors.fieldErrors.push(['', ''])
      continue
    }

    let fieldDefs: FieldDef[]
    {
      const result = validateNumberField((fields[0] ?? '').toString(), HeaderFieldDefs[0])
      if (result.type === 'error') {
        errors.fieldErrors.push([result.reason, ''])
        continue
      }
      const t = +result.value
      try {
        fieldDefs = recordTypeToFieldDefs(t)
      } catch {
        errors.fieldErrors.push(['Unknown record type', ''])
        continue
      }

      // if (fields.length !== fieldDefs.length) {
      //   errors.rowErrors.push({
      //     rowIndex,
      //     reason: `Field count mismatch: expected ${fieldDefs.length}, got ${fields.length}`
      //   })
      //   continue
      // }

      const fieldErrors: string[] = []
      for (let i = 0; i < fieldDefs.length; i++) {
        const def = fieldDefs[i]
        let value = fields[i]
        let reason = ''

        if (def.type === 'N') {
          const result = validateNumberField(value, def)
          if (result.type === 'error') {
            reason = result.reason
          }
        } else if (def.type === 'C') {
          const result = validateCharField(value, def)
          if (result.type === 'error') {
            reason = result.reason
          }
        } else {
          throw _never(def.type)
        }
        fieldErrors.push(reason)
      }
      errors.fieldErrors.push(fieldErrors)
    }
  }
  _assert(errors.fieldErrors.length === table.length)
  _assert(errors.fieldErrors.every((row, rowIndex) => row.length === table[rowIndex].length))

  // Record ordering validation.
  // (header data* trailer)* end $
  let state: 0 | 1 | 2 = 0 // (0: initial or after trailer, 1: after header, 2: after end)
  let invalid = false
  for (const [rowIndex, fields] of table.entries()) {
    if (fields.length === 0) continue
    let error: string | null = null
    const type = +fields[0][0]
    if (!isValidRecordType(type)) {
      invalid = true
      errors.fieldErrors[rowIndex][0] = 'Invalid record type'
      break
    }
    switch (state) {
      case 0:
        switch (type) {
          case RecordTypes.Header: state = 1; continue
          case RecordTypes.End: state = 2; continue
          default: error = 'Expected header or end'; break
        }
        break

      case 1:
        switch (type) {
          case RecordTypes.Data: continue
          case RecordTypes.Trailer: state = 0; continue
          default: error = 'Expected data or trailer'; break
        }
        break

      case 2: error = 'Unexpected any record (after end records)'; break
      default: _never(state)
    }

    if (error) {
      invalid = true
      errors.fieldErrors[rowIndex][0] = error
      break
    }
  }
  if (!invalid && state !== 2) {
    const last = errors.fieldErrors.at(-1)
    if (last && last.length >= 1 && !last[0]) {
      last[0] = state === 0 ? 'Expected trailer record after this' : 'Expected end record after this one'
    }
  }
  return errors
}

export function validateNumberField(value: string, def: FieldDef): Result<string, string> {
  if (value.length > def.size) {
    return Result.Error('size limit exceeded')
  }
  const badChar = reportBadChar(value, NUMBER_REGEXP)
  if (badChar) {
    return Result.Error(badChar)
  }

  return Result.Ok(value.padStart(def.size, '0'))
}

export function validateCharField(value: string, def: FieldDef): Result<string, string> {
  if (value.length > def.size) {
    return Result.Error('size limit exceeded')
  }

  const badChar = reportBadChar(value, CHAR_REGEXP)
  if (badChar) {
    return Result.Error(badChar)
  }
  return Result.Ok(value.padEnd(def.size))
}

function reportBadChar(value: string, regexp: RegExp) {
  const m = value.match(regexp)
  if (m == null || m[0].length !== value.length) {
    const bad = m == null ? 0 : m[0].length
    const c = value.charCodeAt(bad)
    const badChar = c >= 0x20 && c !== 0x7F ? "'" + value[bad] + "' " : ''
    const badCode = value.charCodeAt(bad).toString(16).padStart(4, '0').toUpperCase()
    return `invalid character at ${bad} (${badChar}U+${badCode})`
  }
  return null
}

const NUMBER_REGEXP = /^[0-9]*/

// https://en.wikipedia.org/wiki/Halfwidth_and_Fullwidth_Forms_(Unicode_block)
// FF62-FF63: half-width brackets
// FF66: half-width katakana wo
// FF71-FF9D: half-width (non-small) katakana
// FF9E-FF9F: half-width sonant marks (dakuten, han-dakuten)
const CHAR_REGEXP = /^[- '\(\)+,\./0-9:?A-Z\\\uFF62-\uFF63\uFF66\uFF71-\uFF9F]*/u

// table must be valid in record ordering
export const computeResult = (table: string[][]): TrailerRecord[] => {
  const records: TrailerRecord[] = []
  let current: TrailerRecord = { ...emptyTrailerRecord }

  const def = getRecordType(['2'])!
  const amountIndex = def.findIndex(d => d.name === 'amount')
  const resultCodeIndex = def.findIndex(d => d.name === 'resultCode')

  for (const h of table) {
    const type = +h[0]
    if (type === RecordTypes.Data) {
      _assert(h.length === def.length)
      const amount = +h[amountIndex]
      const resultCode = +h[resultCodeIndex]
      // success
      if (resultCode === 0) {
        current.transferredAmount += amount
        current.transferredCount++
      } else {
        current.failedAmount += amount
        current.failedCount++
      }
      current.totalAmount += amount
      current.totalCount++
      continue
    } else if (type === RecordTypes.Trailer) {
      records.push(current)
      current = { ...emptyTrailerRecord }
    }
  }
  return records
}

export interface TrailerRecord {
  totalCount: number
  totalAmount: number
  transferredCount: number
  transferredAmount: number
  failedCount: number
  failedAmount: number
}

const emptyTrailerRecord: TrailerRecord = { totalAmount: 0, totalCount: 0, transferredAmount: 0, transferredCount: 0, failedAmount: 0, failedCount: 0 }

function _assert(ok: boolean) {
  if (!ok) throw new Error('Assertion violation')
}

function _never(value: never): never {
  throw new Error('unreachable', { cause: value })
}
