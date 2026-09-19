<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">giMMi</div>

    <q-banner v-if="loading" class="bg-grey-3 q-mb-md">Ucitavam podatke iz baze...</q-banner>

    <q-banner v-else-if="error" class="bg-negative text-white q-mb-md">
      {{ error }}
    </q-banner>

    <template v-else>
      <q-banner
        :class="['q-mb-md', health.database === 'ok' ? 'bg-positive' : 'bg-warning', 'text-white']"
      >
        API radi, baza <strong>{{ health.databaseName }}</strong> je {{ health.database }}
      </q-banner>

      <div class="row q-col-gutter-md">
        <div v-for="card in cards" :key="card.label" class="col-12 col-sm-6 col-md-3">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey-7">{{ card.label }}</div>
              <div class="text-h4">{{ card.value }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <div class="text-subtitle1 q-mt-lg q-mb-sm">Korisnici</div>
      <q-table
        flat
        bordered
        :rows="users"
        :columns="userColumns"
        row-key="id_user"
        no-data-label="Nema korisnika u bazi"
        hide-pagination
      />

      <div class="text-subtitle1 q-mt-lg q-mb-sm">Zahtjevi za nabavu</div>
      <q-table
        flat
        bordered
        :rows="purchaseRequests"
        :columns="requestColumns"
        row-key="id_purchase_request"
        no-data-label="Nema zahtjeva u bazi"
        hide-pagination
      />
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

import { gimmiApi } from 'src/services/gimmi-api'

const health = ref(null)
const users = ref([])
const purchaseRequests = ref([])
const fiscalYears = ref([])
const departmentBudgets = ref([])
const loading = ref(true)
const error = ref(null)

const userColumns = [
  {
    name: 'name',
    label: 'Ime',
    align: 'left',
    field: (row) => `${row.first_name} ${row.last_name}`,
  },
  { name: 'email', label: 'E-mail', align: 'left', field: 'email' },
  { name: 'role', label: 'Rola', align: 'left', field: 'role_name' },
  {
    name: 'active',
    label: 'Aktivan',
    align: 'left',
    field: (row) => (row.is_active ? 'da' : 'ne'),
  },
]

const requestColumns = [
  { name: 'number', label: 'Broj', align: 'left', field: 'request_number' },
  { name: 'department', label: 'Odjel', align: 'left', field: 'department_name' },
  { name: 'status', label: 'Status', align: 'left', field: 'status_name' },
  { name: 'year', label: 'Godina', align: 'left', field: 'year' },
  { name: 'amount', label: 'Iznos', align: 'right', field: 'total_amount' },
]

const cards = computed(() => [
  { label: 'Fiskalne godine', value: fiscalYears.value.length },
  { label: 'Odjeli', value: departmentBudgets.value.length },
  { label: 'Korisnici', value: users.value.length },
  { label: 'Zahtjevi', value: purchaseRequests.value.length },
])

onMounted(async () => {
  try {
    ;[
      health.value,
      fiscalYears.value,
      departmentBudgets.value,
      users.value,
      purchaseRequests.value,
    ] = await Promise.all([
      gimmiApi.getHealth(),
      gimmiApi.getFiscalYears(),
      gimmiApi.getDepartmentBudgets(),
      gimmiApi.getUsers(),
      gimmiApi.getPurchaseRequests(),
    ])
  } catch (err) {
    error.value = err.response?.data?.error ?? `API nije dostupan: ${err.message}`
  } finally {
    loading.value = false
  }
})
</script>
