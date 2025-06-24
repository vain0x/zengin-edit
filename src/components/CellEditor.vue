<script setup lang="ts">
import { type FieldDef } from '../zengin'

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
</script>

<template>
  <div class="dt-cell" :data-col="colIndex">
    <v-text-field :label="fieldDef.display" :hint="hint" :model-value="modelValue" :error-messages="error || undefined"
      density="compact" variant="outlined" @input="(ev: Event) => emit('update:modelValue', ev)" />
  </div>
</template>
