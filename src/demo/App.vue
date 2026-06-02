<template>
  <NewSkadiChart />
  <details style="margin-top: 4rem;">
    <summary>Legacy Skadi Chart</summary>
    <LegacySkadiChart />
  </details>
</template>

<script setup lang="ts">
import LegacySkadiChart from "./LegacySkadiChart.vue";
import NewSkadiChart from "./NewSkadiChart.vue";
</script>
