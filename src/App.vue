<script lang="ts" setup>
import { mdiAlert } from '@mdi/js'
import base64js from 'base64-js'
import { computed, ref } from 'vue'
import CellEditor from './components/CellEditor.vue'
import { exampleData } from './example'
import { decodeJis, encodeJis } from './util/encoding'
import { decodeDocument, encodeDocument, getRecordType, validateDocument, type DecodeError, type FieldDef } from './zengin'

type Fields = string[]

const filename = ref('untitled.txt')
const currentTable = ref<Fields[]>([])
const textData = ref('')
const decodeErrors = ref<DecodeError[]>([])

function onFileChange(ev: Event) {
  const inputEl = ev.target as HTMLInputElement & { type: 'file' }
  console.log('onFileChange', ev, inputEl, inputEl.files?.[0]?.name)
  if (inputEl.files && inputEl.files.length >= 1) {
    const file = inputEl.files[0]
    !(async () => {
      const bytes = await file.arrayBuffer()
      console.log('file loaded', bytes.byteLength)

      const text = decodeJis(new Uint8Array(bytes))
      console.log('decoded', text.length, text)
      filename.value = file.name
      textData.value = text
    })()
  }
}

function onDownload() {
  console.log('download', textData.value)
  const bytes = encodeJis(textData.value)
  const dataUrl = 'data:text/plain;base64,' + base64js.fromByteArray(bytes)

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename.value
  a.style.position = 'fixed'
  a.style.opacity = '0'
  document.body.append(a)
  a.click()
  a.remove()
}

function onReset() {
  const confirmed = window.confirm('Reset?')
  if (confirmed) {
    setText(exampleData)
  }
}

function onTextChange(ev: Event) {
  const inputEl = ev.target as HTMLInputElement
  console.log('onTextChange', ev)
  setText(inputEl.value)
}

function setText(text: string) {
  textData.value = text
  const decoded = decodeDocument(encodeJis(textData.value))
  currentTable.value = structuredClone(decoded.rows)
  decodeErrors.value = decoded.errors
}

function getFieldDef(rowIndex: number, colIndex: number): FieldDef {
  return rowTypes.value?.at(rowIndex)?.type?.at(colIndex) || unknownField
}

const unknownField: FieldDef = {
  type: 'C', name: 'unknown', size: 120, display: '不明',
}

const rowTypes = computed(() => {
  const table = currentTable.value
  return table.map(row => {
    return { type: getRecordType(row as string[]), row }
  })
})

const validationResult = computed(() => {
  return validateDocument(currentTable.value)
})

function getCellErrorAt(rowIndex: number, colIndex: number) {
  return validationResult.value.fieldErrors.at(rowIndex)?.at(colIndex) || undefined
}

const hasError = computed(() => {
  const r = validationResult.value
  return r.fieldErrors.some(fields => fields.some(f => !!f))
})

function onTableChange(value: string, rowIndex: number, colIndex: number) {
  console.log('onTableChange', value, rowIndex, colIndex)

  let tableUpdated = false

  // type change
  if (colIndex === 0) {
    let fields = currentTable.value[rowIndex]
    const fieldDef = getRecordType(fields)
    fields = fields.map((field, index) => index === 0 ? value : field)
    const encodedRow = encodeDocument([fields], [fieldDef])
    const decoded = decodeDocument(encodedRow)
    const updatedRow = decoded.rows.at(0)
    if (updatedRow != null) {
      currentTable.value = currentTable.value.map((row, ri) => {
        if (ri !== rowIndex) {
          return row
        }
        return updatedRow
      })
      tableUpdated = true
    }
  }

  if (!tableUpdated) {
    currentTable.value = currentTable.value.map((row, ri) => {
      if (ri !== rowIndex) {
        return row
      }
      return row.map((col, ci) => {
        if (ci !== colIndex) {
          return col
        }
        return value
      })
    })
  }
  textData.value = decodeJis(encodeDocument(currentTable.value, currentTable.value.map(row => getRecordType(row))))
}

// initialize
setText(exampleData)
</script>

<template>
  <div class="container">
    <h1>Zengin Edit (Account Transfer)</h1>

    <div class="control-panel">
      <input type="file" @change="onFileChange" />
      <v-btn text="Download" color="primary" @click="onDownload"></v-btn>
      <div style="width: 48px"></div>
      <v-btn density="compact" @click="onReset">Reset</v-btn>
    </div>

    <v-text-field label="Filename" v-model="filename" />

    <v-textarea label="Text" :model-value="textData" @input="onTextChange" rows="4" />

    <v-alert v-if="decodeErrors.length !== 0" type="error" style="margin-block-end: 32px;">
      Some lines don't have 120 bytes.
      {{'(Line numbers: ' + decodeErrors.map(e => e.rowIndex + 1).join(', ') + ').'}}
    </v-alert>

    <h2>
      Table
      <v-icon v-if="hasError" :icon="mdiAlert" color="red" size="20" />
    </h2>
    <div class="dt-container">
      <div v-for="(row, rowIndex) in currentTable" class="dt-row" :data-row="rowIndex">
        <CellEditor v-for="(field, colIndex) in row" :model-value="field" :field-def="getFieldDef(rowIndex, colIndex)"
          :rowIndex="rowIndex" :colIndex="colIndex" :error="getCellErrorAt(rowIndex, colIndex)"
          @update:model-value="(value: string) => onTableChange(value, rowIndex, colIndex)" />
      </div>
    </div>
  </div>
  <div v-if="currentTable.length === 0">
    <div>Empty data.</div>
  </div>
</template>

<style scoped></style>
