<script setup lang="ts">
import { Icon } from '@iconify/vue';

// A second collection, in a nested directory, to show the scan is recursive
// and groups by prefix. Both prefixes are listed in vite.config.ts; one that
// is not listed would never be searched for at all.
const STACK = ['simple-icons:vuedotjs', 'simple-icons:vite'];
</script>

<template>
  <ul>
    <li v-for="name in STACK" :key="name">
      <!-- The name in this comment — `lucide:package` — reaches the bundle too.
           The scan is a text search, not a parse. Misspell it and the build
           fails, which is the trade the plugin is built around. -->
      <Icon :icon="name" width="24" />
    </li>
  </ul>
</template>
