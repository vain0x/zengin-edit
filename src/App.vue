<script lang="ts" setup>
import { mdiAlert } from '@mdi/js'
import base64js from 'base64-js'
import { computed, ref } from 'vue'
import { exampleData } from './example'
import { decodeJis, encodeJis } from './util/encoding'
import { decodeDocument, encodeDocument, getRecordType, validateDocument, type DecodeError } from './zengin'

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

function getLabel(rowIndex: number | null, colIndex: number | null): string | undefined {
  if (rowIndex == null || colIndex == null) {
    return undefined
  }
  return rowTypes.value?.at(rowIndex)?.type?.at(colIndex)?.display || undefined
}

function getType(rowIndex: number | null, colIndex: number | null): string | undefined {
  if (rowIndex == null || colIndex == null) {
    return undefined
  }
  const def = rowTypes.value?.at(rowIndex)?.type?.at(colIndex)
  if (!def) {
    return undefined
  }
  return `${def.type}(${def.size})`
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

function onTableChange(ev: Event, rowIndex: number, colIndex: number) {
  const inputEl = ev.target as HTMLInputElement
  console.log('onTableChange', ev.target, rowIndex, colIndex)
  const value = inputEl.value
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
        <div v-for="(field, colIndex) in row" class="dt-cell" :data-col="colIndex">
          <v-text-field :label="getLabel(rowIndex, colIndex)" :hint="getType(rowIndex, colIndex)" :model-value="field"
            :error-messages="getCellErrorAt(rowIndex, colIndex)" density="compact" variant="outlined"
            @input="(ev: Event) => onTableChange(ev, rowIndex, colIndex)" />
        </div>
      </div>
    </div>
  </div>
  <div v-if="currentTable.length === 0">
    <div>Empty data.</div>
  </div>
</template>

<style scoped></style>
