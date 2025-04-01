<template>
  Cowsays: {{ cowSays }}
</template>

<script setup lang="ts">
defineProps({
  cowSays: String
})
</script>
