<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">{{ title }}</div>

    <q-banner class="bg-grey-3">
      <template #avatar>
        <q-icon name="construction" color="grey-7" />
      </template>
      Ekran je u izradi.
    </q-banner>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// Naslov dolazi iz meta podatka rute, pa jedna komponenta pokriva sve ekrane
// koji jos nisu napravljeni.
const route = useRoute()

const title = computed(() => route.meta.title ?? '')
</script>
