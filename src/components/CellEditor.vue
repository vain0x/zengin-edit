<script lang="ts">
const textFieldUi: FieldUi = {
  type: 'text-field'
}
</script>

<script setup lang="ts">
import { type FieldDef, type FieldUi } from '../zengin'

const props = defineProps({
  modelValue: String,
  rowIndex: Number,
  colIndex: Number,
  fieldDef: Object,
  error: String,
})
const emit = defineEmits(['update:modelValue'])

const fieldDef = props.fieldDef as FieldDef
const hint = fieldDef.type + '(' + fieldDef.size + ')'
const ui = fieldDef.ui ?? textFieldUi

function onUpdate(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="dt-cell" :data-col="colIndex">
    <v-text-field v-if="ui.type === 'text-field'" :label="fieldDef.display" :hint="hint" :model-value="modelValue"
      :error-messages="error || undefined" density="compact" variant="outlined" @update:model-value="onUpdate" />
    <v-select v-if="ui.type === 'select'" :label="fieldDef.display" :hint="hint" :model-value="modelValue"
      :error-messages="error || undefined" density="compact" @update:model-value="onUpdate" :items="ui.options"
      :open-text="(() => { const title = ui.options.find(option => option.value === modelValue)?.title; return modelValue ? modelValue + ': ' + title : undefined })()"></v-select>
  </div>
</template>
