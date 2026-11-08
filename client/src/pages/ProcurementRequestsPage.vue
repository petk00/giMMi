<template>
  <q-page class="bg-grey-2 with-page-header">
    <div class="page-header row items-center no-wrap q-px-lg q-gutter-sm">
      <q-input
        v-model="search"
        dense
        outlined
        bg-color="white"
        placeholder="Broj, podnositelj, svrha"
        class="search-field"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <q-select
        v-model="department"
        dense
        outlined
        bg-color="white"
        label="Služba"
        :options="departmentOptions"
        class="filter-field"
      />

      <q-select
        v-model="period"
        dense
        outlined
        bg-color="white"
        label="Razdoblje"
        :options="periodOptions"
        class="filter-field"
      />

      <q-btn outline no-caps color="grey-8" label="Izvoz" />
    </div>

    <div class="q-px-lg q-pb-lg">
      <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>

      <div class="row q-col-gutter-md q-mb-lg">
        <div v-for="card in summaryCards" :key="card.label" class="col-12 col-sm-6 col-lg-3">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="summary-label">{{ card.label }}</div>
              <div class="summary-value num q-mt-sm">{{ card.value }}</div>
              <div class="text-body2 text-grey-7 q-mt-xs">{{ card.caption }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <q-tabs
        v-model="tab"
        align="left"
        no-caps
        class="text-grey-7"
        active-color="primary"
        indicator-color="primary"
      >
        <q-tab v-for="item in tabs" :key="item.name" :name="item.name">
          <div class="row items-center q-gutter-xs">
            <span>{{ item.label }}</span>
            <q-badge v-if="countFor(item.name)" color="grey-4" text-color="grey-9" rounded>
              {{ countFor(item.name) }}
            </q-badge>
          </div>
        </q-tab>
      </q-tabs>

      <q-separator />

      <q-table
        v-model:selected="selected"
        v-model:pagination="pagination"
        flat
        bordered
        square
        selection="multiple"
        :rows="visibleRows"
        :columns="columns"
        row-key="id_purchase_request"
        class="bg-white requests-table"
        :loading="loading"
        no-data-label="Nema zahtjeva u ovoj skupini"
        @row-click="onRowClick"
      >
        <template #body-cell-number="props">
          <q-td :props="props">
            <div class="text-weight-medium">{{ props.row.request_number }}</div>
            <div class="text-caption text-grey-7">
              {{ props.row.source === 'OFFER' ? 'ponuda' : 'katalog' }}
            </div>
          </q-td>
        </template>

        <template #body-cell-requester="props">
          <q-td :props="props">
            <div>{{ props.row.created_by_name }}</div>
            <div class="text-caption text-grey-7">{{ props.row.department_name }}</div>
          </q-td>
        </template>

        <template #body-cell-subject="props">
          <q-td :props="props">
            <div class="subject-cell ellipsis">{{ props.row.justification || '—' }}</div>
          </q-td>
        </template>

        <template #body-cell-coverage="props">
          <q-td :props="props">
            <q-chip
              v-if="props.row.coverage"
              dense
              outline
              :color="coverageColors[props.row.coverage.state]"
              :class="{ 'coverage-chip--missing': props.row.coverage.state === 'missing' }"
              :label="props.row.coverage.label"
            />
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <q-chip
              dense
              outline
              :color="statusColors[props.row.status_code] ?? 'grey-7'"
              :label="props.row.status_name"
            />
            <div v-if="props.row.assigned_to_name" class="text-caption text-grey-7">
              {{ props.row.assigned_to_name }}
            </div>
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props" class="text-right">
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              label="Obradi"
              @click.stop="openRequest(props.row)"
            />
          </q-td>
        </template>

        <!-- Skupne radnje stoje uz raspon, pa je dno tablice jedan red. -->
        <template #bottom>
          <div class="row items-center full-width q-gutter-sm">
            <span class="text-body2 text-grey-7">Označeno: {{ selected.length }}</span>

            <q-btn
              outline
              dense
              no-caps
              color="grey-8"
              label="Odobri označene"
              :disable="selected.length === 0"
            />

            <q-btn
              outline
              dense
              no-caps
              color="grey-8"
              label="Dodijeli kategoriju označenima"
              :disable="selected.length === 0"
              @click="openAssign"
            />

            <q-space />

            <span class="text-body2 text-grey-7">{{ rangeLabel }}</span>

            <q-btn
              flat
              dense
              round
              icon="chevron_left"
              color="grey-8"
              :disable="pagination.page === 1"
              aria-label="Prethodna stranica"
              @click="pagination.page -= 1"
            />

            <q-btn
              flat
              dense
              round
              icon="chevron_right"
              color="grey-8"
              :disable="pagination.page >= pageCount"
              aria-label="Sljedeća stranica"
              @click="pagination.page += 1"
            />
          </div>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="assignDialog">
      <q-card style="width: 440px; max-width: 90vw">
        <q-card-section class="text-h6">Dodijeli kategoriju</q-card-section>

        <q-card-section class="q-pt-none q-gutter-md">
          <div class="text-body2 text-grey-8">
            Kategorija ide stavkama bez kategorije u {{ selected.length }}
            {{ selected.length === 1 ? 'označenom zahtjevu' : 'označenih zahtjeva' }}. Stavke koje
            već imaju kategoriju ostaju kakve jesu.
          </div>

          <q-select
            v-model="assignCategory"
            outlined
            emit-value
            map-options
            label="Kategorija"
            :options="categoryOptions"
            :loading="loadingCategories"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.caption }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps color="grey-8" label="Odustani" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Dodijeli"
            :loading="assigning"
            :disable="assignCategory === null"
            @click="confirmAssign"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import { gimmiApi } from 'src/services/gimmi-api'

const $q = useQuasar()
const router = useRouter()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })

const search = ref('')
const department = ref(null)
const period = ref(null)

const allDepartments = 'Sve službe'
const periodOptions = ['Sva razdoblja', 'Ovaj mjesec', 'Prošli mjesec', 'Ova godina']

// Svaki tab je jedan status; nacrti ne idu u nabavu pa ih nema ni pod "Svi".
const tabs = [
  { name: 'novi', label: 'Novi', status: 'SUBMITTED' },
  { name: 'u-obradi', label: 'U obradi', status: 'IN_PROGRESS' },
  { name: 'ceka-dopunu', label: 'Čeka dopunu', status: 'NEEDS_INFO' },
  { name: 'odobreni', label: 'Odobreni', status: 'APPROVED' },
  { name: 'naruceni', label: 'Naručeni', status: 'ORDERED' },
  { name: 'odbijeni', label: 'Odbijeni', status: 'REJECTED' },
  { name: 'svi', label: 'Svi' },
]

const statusColors = {
  SUBMITTED: 'blue-8',
  IN_PROGRESS: 'blue-8',
  NEEDS_INFO: 'orange-9',
  APPROVED: 'teal-8',
  ORDERED: 'teal-8',
  RECEIVED: 'teal-8',
  CLOSED: 'grey-8',
  REJECTED: 'red-8',
}

const columns = [
  { name: 'number', label: 'Zahtjev', field: 'request_number', align: 'left' },
  { name: 'requester', label: 'Podnositelj / služba', field: 'created_by_name', align: 'left' },
  { name: 'subject', label: 'Predmet', field: 'justification', align: 'left' },
  {
    name: 'amount',
    label: 'Iznos',
    field: 'total_amount',
    align: 'right',
    format: (value) => currencyFormat.format(value ?? 0),
  },
  { name: 'waiting', label: 'Čeka', field: 'updated_at', align: 'left', format: waitingLabel },
  { name: 'coverage', label: 'Pokriće', field: 'coverage', align: 'left' },
  { name: 'status', label: 'Status', field: 'status_name', align: 'left' },
  { name: 'action', label: '', field: 'id_purchase_request', align: 'right' },
]

// Boja govori sto s pokricem nije u redu; isprekidani okvir nosi zaseban razred.
const coverageColors = {
  ok: 'grey-8',
  warn: 'orange-9',
  missing: 'orange-9',
}

// o ovim zahtjevima jos nije odluceno, pa pokrice jos moze utjecati na odluku
const openStatuses = ['SUBMITTED', 'IN_PROGRESS', 'NEEDS_INFO']

const requests = ref([])
const loading = ref(true)
const error = ref(null)

// tiho ucitavanje (nakon skupne radnje) ne prazni tablicu
async function load({ quiet = false } = {}) {
  loading.value = !quiet
  error.value = null

  try {
    const rows = await gimmiApi.getPurchaseRequests()
    requests.value = rows.filter((row) => row.status_code !== 'DRAFT')
  } catch (err) {
    error.value = err.response?.data?.error ?? `Dohvat zahtjeva nije uspio: ${err.message}`
  } finally {
    loading.value = false
  }
}

onMounted(() => load())

function daysSince(value) {
  const start = new Date(value)
  start.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.round((today - start) / 86400000)
}

// koliko zahtjev stoji u trenutnom statusu
function waitingLabel(value) {
  return daysLabel(daysSince(value))
}

function daysLabel(days) {
  if (days <= 0) return 'danas'
  if (days === 1) return '1 dan'

  return `${days} dana`
}

const departmentOptions = computed(() => [
  allDepartments,
  ...[...new Set(requests.value.map((row) => row.department_name))].sort((a, b) =>
    a.localeCompare(b, 'hr'),
  ),
])

function inPeriod(row) {
  const created = new Date(row.created_at)
  const now = new Date()

  switch (period.value) {
    case 'Ovaj mjesec':
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
    case 'Prošli mjesec': {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return created.getFullYear() === last.getFullYear() && created.getMonth() === last.getMonth()
    }
    case 'Ova godina':
      return created.getFullYear() === now.getFullYear()
    default:
      return true
  }
}

// trazilica i filteri vrijede za sve tabove, pa i brojke na njima
const filteredRows = computed(() => {
  const term = search.value.trim().toLowerCase()

  return requests.value.filter(
    (row) =>
      (!department.value ||
        department.value === allDepartments ||
        row.department_name === department.value) &&
      inPeriod(row) &&
      (term === '' ||
        [row.request_number, row.created_by_name, row.department_name, row.justification]
          .filter(Boolean)
          .some((text) => text.toLowerCase().includes(term))),
  )
})

function rowsForTab(name) {
  const status = tabs.find((item) => item.name === name)?.status

  return status
    ? filteredRows.value.filter((row) => row.status_code === status)
    : filteredRows.value
}

function countFor(name) {
  return name === 'svi' ? 0 : rowsForTab(name).length
}

const summaryCards = computed(() => {
  const waitingNew = requests.value.filter((row) => row.status_code === 'SUBMITTED')
  const needsInfo = requests.value.filter((row) => row.status_code === 'NEEDS_INFO')
  const uncovered = requests.value.filter(
    (row) => openStatuses.includes(row.status_code) && row.coverage && row.coverage.state !== 'ok',
  )
  const missingCategory = uncovered.filter((row) => row.coverage.state === 'missing').length
  const overBudget = uncovered.length - missingCategory

  const now = new Date()
  // odobreni ovaj mjesec: zadnja promjena statusa je u ovom mjesecu
  const approved = requests.value.filter((row) => {
    const changed = new Date(row.updated_at)

    return (
      row.status_code === 'APPROVED' &&
      changed.getFullYear() === now.getFullYear() &&
      changed.getMonth() === now.getMonth()
    )
  })

  const oldestDays = Math.max(0, ...waitingNew.map((row) => daysSince(row.created_at)))
  const longNeedsInfo = needsInfo.filter((row) => daysSince(row.updated_at) > 7).length

  return [
    {
      label: 'Novi, nedodijeljeni',
      value: waitingNew.length,
      caption: waitingNew.length ? `najstariji čeka ${daysLabel(oldestDays)}` : 'nema novih',
    },
    {
      label: 'Čeka dopunu',
      value: needsInfo.length,
      caption: longNeedsInfo ? `${longNeedsInfo} duže od tjedna` : 'nijedan duže od tjedna',
    },
    {
      label: 'Odobreno ovaj mjesec',
      value: currencyFormat.format(
        approved.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0),
      ),
      caption: `${approved.length} ${approved.length === 1 ? 'zahtjev' : 'zahtjeva'}`,
    },
    {
      label: 'Bez pokrića',
      value: uncovered.length,
      caption: uncovered.length
        ? `${missingCategory} bez kategorije, ${overBudget} preko limita`
        : 'svi otvoreni su pokriveni',
    },
  ]
})

const tab = ref('novi')
const selected = ref([])
const pagination = ref({ page: 1, rowsPerPage: 10 })

const visibleRows = computed(() => rowsForTab(tab.value))

const pageCount = computed(
  () => Math.ceil(visibleRows.value.length / pagination.value.rowsPerPage) || 1,
)

const rangeLabel = computed(() => {
  const total = visibleRows.value.length

  if (total === 0) {
    return '0 zahtjeva'
  }

  const first = (pagination.value.page - 1) * pagination.value.rowsPerPage + 1
  const last = Math.min(first + pagination.value.rowsPerPage - 1, total)

  return `${first}–${last} od ${total}`
})

const assignDialog = ref(false)
const assignCategory = ref(null)
const assigning = ref(false)
const categories = ref([])
const loadingCategories = ref(false)

const categoryOptions = computed(() =>
  categories.value
    .filter((cat) => cat.is_active === 1)
    .map((cat) => ({
      value: cat.id_item_category_budget,
      label: `${cat.name} (${cat.year})`,
      caption: `slobodno ${currencyFormat.format(cat.budget_limit - cat.committed_amount)}`,
    })),
)

async function openAssign() {
  assignCategory.value = null
  assignDialog.value = true
  loadingCategories.value = true

  try {
    categories.value = await gimmiApi.getItemCategoryBudgets()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.response?.data?.error ?? err.message })
  } finally {
    loadingCategories.value = false
  }
}

async function confirmAssign() {
  assigning.value = true

  try {
    const result = await gimmiApi.assignCategory(
      selected.value.map((row) => row.id_purchase_request),
      assignCategory.value,
    )

    $q.notify({
      type: result.updatedItems > 0 ? 'positive' : 'info',
      message:
        result.updatedItems > 0
          ? `Kategorija je dodana na ${result.updatedItems} ${result.updatedItems === 1 ? 'stavku' : 'stavki'}.`
          : 'Nijedna označena stavka nije bila bez kategorije.',
      caption: result.skipped.length
        ? `Preskočeno, o njima je već odlučeno: ${result.skipped.join(', ')}`
        : undefined,
    })

    assignDialog.value = false
    selected.value = []
    await load({ quiet: true })
  } catch (err) {
    $q.notify({ type: 'negative', message: err.response?.data?.error ?? err.message })
  } finally {
    assigning.value = false
  }
}

function openRequest(row) {
  router.push(`/zahtjevi/${row.id_purchase_request}`)
}

// klik na kvacicu oznacava red, ne otvara zahtjev
function onRowClick(evt, row) {
  if (evt.target.closest('.q-checkbox')) {
    return
  }

  openRequest(row)
}

// promjena skupine ili filtera krece od prve stranice i bez zaostalih kvacica
watch([tab, search, department, period], () => {
  pagination.value.page = 1
  selected.value = []
})
</script>

<style scoped>
/* ista visina kao zaglavlje ladice, pa sadrzaj krece u ravnini s njezinom crtom */
.page-header {
  min-height: 64px;
}

.search-field {
  width: 280px;
}

.filter-field {
  width: 170px;
}

.summary-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.55);
}

.summary-value {
  font-size: 28px;
  font-weight: 500;
  line-height: 1.2;
}

/* cijeli red otvara zahtjev */
.requests-table :deep(tbody tr) {
  cursor: pointer;
}

/* zahtjev bez kategorije je praznina, ne podatak - zato isprekidani okvir */
.coverage-chip--missing {
  border-style: dashed;
}

.subject-cell {
  max-width: 320px;
}

/* brojke se poravnavaju po znamenkama */
.num {
  font-variant-numeric: tabular-nums;
}

:deep(th) {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
</style>
