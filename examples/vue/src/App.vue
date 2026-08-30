<script setup lang="ts">
import { Icon } from '@iconify/vue';
import StackRow from './components/StackRow.vue';

// A .vue file is scanned exactly like a .ts one — `.vue` and `.ts` are the
// default `extensions`. These names are quoted literals, which is the only
// form the scan can see.
const NAV = ['lucide:house', 'lucide:mail', 'lucide:circle-check-big'];
</script>

<template>
  <nav>
    <Icon v-for="name in NAV" :key="name" :icon="name" width="32" />
  </nav>
  <StackRow />
</template>
