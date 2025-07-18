<script lang="ts" setup>
import { mdiAlert, mdiDownload, mdiPaperclip } from '@mdi/js'
import base64js from 'base64-js'
import { computed, ref } from 'vue'
import CellEditor from './components/CellEditor.vue'
import { exampleData } from './example'
import { decodeJis, encodeJis } from './util/encoding'
import { computeResult, decodeDocument, encodeDocument, getRecordType, RecordTypes, validateDocument, type DecodeError, type FieldDef } from './zengin'

type Fields = string[]

const filename = ref('untitled.txt')
const currentTable = ref<Fields[]>([])
const textData = ref('')
const decodeErrors = ref<DecodeError[]>([])

const selectedLinebreakOption = ref('CRLF')
const linebreakOptions = [
  { value: 'CRLF', title: 'CR+LF' },
  { value: 'none', title: 'なし' },
]

function selectFile() {
  document.querySelector<HTMLInputElement>('input[type=file]')?.click()
}

function onFileChange(ev: Event) {
  const inputEl = ev.target as HTMLInputElement & { type: 'file' }
  if (inputEl.files && inputEl.files.length >= 1) {
    const file = inputEl.files[0]
    !(async () => {
      const bytes = await file.arrayBuffer()
      const text = decodeJis(new Uint8Array(bytes))
      filename.value = file.name
      setText(text)
    })()
  }
}

function onDownload() {
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

function onTextChange(ev: Event) {
  const inputEl = ev.target as HTMLInputElement
  setText(inputEl.value)
}

// text -> table
function setText(text: string) {
  textData.value = text
  const decoded = decodeDocument(encodeJis(textData.value))
  currentTable.value = structuredClone(decoded.rows)
  decodeErrors.value = decoded.errors
}

function onSelectedLinebreakChange(value: string) {
  selectedLinebreakOption.value = value
  updateTextData()
}

function getFieldDef(rowIndex: number, colIndex: number): FieldDef {
  return rowTypes.value?.at(rowIndex)?.type?.at(colIndex) || unknownField
}

const unknownField: FieldDef = {
  type: 'C', name: 'unknown', size: 120, title: '不明',
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
  const cellError = validationResult.value.fieldErrors.at(rowIndex)?.at(colIndex) || undefined
  if (cellError) {
    return cellError
  }

  if (!hasError.value) {
    let blockIndex = 0
    for (let i = 0; i < rowIndex; i++) {
      const fields = currentTable.value[i]
      if (+fields[0] === RecordTypes.Trailer) {
        blockIndex++
      }
    }

    const def = getFieldDef(rowIndex, colIndex)
    const trailer = trailerRecords.value?.at(blockIndex)
    if (def && trailer && Object.hasOwn(trailer, def.name)) {
      const inputValue = currentTable.value[rowIndex][colIndex]
      const computedValue = (trailer as any)[def.name]
      if (+computedValue !== +inputValue) {
        return '計算値: ' + computedValue
      }
    }
  }
  return undefined
}

const hasError = computed(() => {
  const r = validationResult.value
  return r.fieldErrors.some(fields => fields.some(f => !!f))
})

const trailerRecords = computed(() => {
  if (hasError.value) {
    return null
  }
  const table = currentTable.value
  return computeResult(table)
})

function onTableChange(value: string, rowIndex: number, colIndex: number) {
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
  updateTextData()
}

// table -> text
function updateTextData() {
  const linebreak = selectedLinebreakOption.value as 'CRLF' | 'none'

  textData.value = decodeJis(encodeDocument(currentTable.value, currentTable.value.map(row => getRecordType(row)), { linebreak }))
}

// initialize
setText(exampleData)
</script>

<template>
  <v-app>
    <v-app-bar density="compact">
      <template #title>
        <div style="font-weight: bold;">
          Zengin Edit
          <span style="font: 1rem normal; color: #4D4D4D;">(15. 預金口座振替)</span>
        </div>
      </template>
      <template #append>
        <div style="color: red;">
          ※非公式のツールです。動作の保証はありません
        </div>
      </template>
    </v-app-bar>

    <v-main>
      <v-container>
        <div class="control-panel">
          <div style="position: relative;">
            <v-btn title="Open file" variant="elevated" color="primary" height="40px" @click="selectFile">
              <v-icon :icon="mdiPaperclip" size="24"></v-icon>
              開く
            </v-btn>
            <input type="file" style="position: absolute; inset: 0; opacity: 0;" @change="onFileChange" />
          </div>
          <v-text-field label="Filename" v-model="filename" variant="filled" density="compact" style="flex: 1" />
          <v-btn title="Download" variant="elevated" color="primary" @click="onDownload">
            <v-icon :icon="mdiDownload"></v-icon>
            ダウンロード
          </v-btn>
          <!-- <v-btn @click="onReset">
            <v-icon :icon="mdiClose"></v-icon>
            リセット
          </v-btn> -->
        </div>

        <div>
          <v-textarea label="Text" :model-value="textData" @input="onTextChange" rows="4" />

          <div style="margin-block-start: -1rem; display: flex;">
            <div style="margin-inline-start: auto; width: 200px;">
              <v-select label="改行" :model-value="selectedLinebreakOption"
                @update:model-value="onSelectedLinebreakChange" :items="linebreakOptions" />
            </div>
          </div>
        </div>

        <v-alert v-if="decodeErrors.length !== 0" type="error" style="margin-block-end: 32px;">
          {{'120バイトに満たない行があります (' + decodeErrors.map(e => e.rowIndex + 1).join(', ') + ' 行目)'}}
        </v-alert>

        <h2 style="display: flex; align-items: center; gap: 4px;">
          <div style="font-size: 1rem;">
            テーブル表示
          </div>
          <v-icon v-if="hasError" :icon="mdiAlert" color="red" size="20" />
        </h2>
        <div v-for="(row, rowIndex) in currentTable" class="dt-row" :data-row="rowIndex">
          <CellEditor v-for="(field, colIndex) in row" :model-value="field" :field-def="getFieldDef(rowIndex, colIndex)"
            :rowIndex="rowIndex" :colIndex="colIndex" :error="getCellErrorAt(rowIndex, colIndex)"
            @update:model-value="(value: string) => onTableChange(value, rowIndex, colIndex)" />
        </div>
        <div v-if="currentTable.length === 0">
          <div style="color: #4D4D4D;">
            {{ 'データがありません' }}
          </div>
        </div>
      </v-container>
    </v-main>

    <div style="background-color: #F5F5F5;">
      <v-container>
        <v-list>
          <v-list-subheader>
            詳細
          </v-list-subheader>
          <v-list-item>
            レコードフォーマットの仕様は <a href="https://www.zenginkyo.or.jp/abstract/efforts/system/protocol/">全銀協のウェブサイト</a>
            にあるPDFの「15. 預金口座振替（依頼明細）」を参照
          </v-list-item>
          <v-list-item>
            非公式のツールです。動作の保証はありません
            <div>・入力ファイルを正確に処理できるとはかぎりません</div>
            <div>・ダウンロードされるファイルの内容が適切であるとはかぎりません</div>
          </v-list-item>
          <v-list-item>
            個人情報を含むデータをアップロードしないでください
          </v-list-item>
          <v-list-item>
            文字コードは JIS のみ対応しています (EBCDIC は非対応)
          </v-list-item>
        </v-list>
      </v-container>
    </div>
  </v-app>
</template>

<style scoped></style>
