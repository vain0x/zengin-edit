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
    <v-text-field v-if="ui.type === 'text-field'" :label="fieldDef.title" :hint="hint" :model-value="modelValue"
      :error-messages="error || undefined" density="compact" variant="outlined" @update:model-value="onUpdate" />
    <v-select v-if="ui.type === 'select'" :label="fieldDef.title" :hint="hint" :model-value="modelValue"
      :prefix="(() => { const option = ui.options.find(option => option.value === modelValue); return option ? `${modelValue}:` : undefined })()"
      :error-messages="error || undefined" density="compact" @update:model-value="onUpdate" :items="ui.options"
      :menu-icon="ui.readonly ? '' : undefined" :readonly="ui.readonly"></v-select>
  </div>
</template>
