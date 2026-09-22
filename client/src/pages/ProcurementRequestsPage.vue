<template>
  <q-page class="bg-grey-2 with-page-header">
    <!-- Zaglavlje stoji u traci logotipa, kao i na novom zahtjevu. -->
    <div class="page-header row items-center no-wrap q-px-lg q-gutter-sm">
      <div class="text-h6 col">Zahtjevi</div>

      <q-input
        v-model="search"
        dense
        outlined
        bg-color="white"
        placeholder="Broj, podnositelj, artikl"
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
      <!-- Brojke su zasad izmisljene; dolaze sa servera kad se ekran spoji. -->
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
            <q-badge v-if="item.count" color="grey-4" text-color="grey-9" rounded>
              {{ item.count }}
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
        row-key="number"
        class="bg-white"
        no-data-label="Nema zahtjeva u ovoj skupini"
      >
        <template #body-cell-number="props">
          <q-td :props="props">
            <div class="text-weight-medium">{{ props.row.number }}</div>
            <div class="text-caption text-grey-7">{{ props.row.source }}</div>
          </q-td>
        </template>

        <template #body-cell-requester="props">
          <q-td :props="props">
            <div>{{ props.row.requester }}</div>
            <div class="text-caption text-grey-7">{{ props.row.unit }}</div>
          </q-td>
        </template>

        <template #body-cell-coverage="props">
          <q-td :props="props">
            <q-chip
              dense
              outline
              :color="coverageColors[props.row.coverage.state]"
              :class="{ 'coverage-chip--missing': props.row.coverage.state === 'missing' }"
              :label="props.row.coverage.label"
            />
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props" class="text-right">
            <q-btn outline dense no-caps color="primary" label="Obradi" />
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
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })

const search = ref('')
const department = ref(null)
const period = ref(null)

const departmentOptions = ['Sve službe', 'Služba za IT', 'Služba za nastavu', 'Projekti']
const periodOptions = ['Ovaj mjesec', 'Prošli mjesec', 'Ova godina']

const summaryCards = [
  { label: 'Novi, nedodijeljeni', value: '7', caption: 'najstariji čeka 3 dana' },
  { label: 'Čeka dopunu', value: '4', caption: '2 duže od tjedna' },
  { label: 'Odobreno ovaj mjesec', value: currencyFormat.format(18402), caption: '41 zahtjev' },
  { label: 'Bez pokrića', value: '2', caption: 'kategorija u minusu' },
]

const tabs = [
  { name: 'novi', label: 'Novi', count: 7 },
  { name: 'u-obradi', label: 'U obradi', count: 12 },
  { name: 'ceka-dopunu', label: 'Čeka dopunu', count: 4 },
  { name: 'odobreni', label: 'Odobreni' },
  { name: 'naruceni', label: 'Naručeni' },
  { name: 'odbijeni', label: 'Odbijeni' },
  { name: 'svi', label: 'Svi' },
]

const columns = [
  { name: 'number', label: 'Zahtjev', field: 'number', align: 'left' },
  { name: 'requester', label: 'Podnositelj / služba', field: 'requester', align: 'left' },
  { name: 'subject', label: 'Predmet', field: 'subject', align: 'left' },
  {
    name: 'amount',
    label: 'Iznos',
    field: 'amount',
    align: 'right',
    format: (value) => currencyFormat.format(value),
  },
  { name: 'waiting', label: 'Čeka', field: 'waiting', align: 'left' },
  { name: 'coverage', label: 'Pokriće', field: 'coverage', align: 'left' },
  { name: 'action', label: '', field: 'number', align: 'right' },
]

// Boja govori sto s pokricem nije u redu; dashed okvir nosi zaseban razred.
const coverageColors = {
  ok: 'grey-8',
  info: 'grey-8',
  warn: 'orange-9',
  missing: 'orange-9',
}

// Izmisljeni redovi dok ekran ne dobije podatke sa servera.
const rows = [
  {
    tab: 'novi',
    number: 'ZN-2026-0188',
    source: 'ponuda',
    requester: 'Ana Kovač',
    unit: 'Projekt HORIZON-4412',
    subject: 'Mjerna sonda s kalibracijom',
    amount: 3870,
    waiting: '3 dana',
    coverage: { state: 'info', label: 'predložena kat. ima 12.400 €' },
  },
  {
    tab: 'novi',
    number: 'ZN-2026-0187',
    source: 'katalog',
    requester: 'Petar Babić',
    unit: 'Služba za nastavu',
    subject: 'Uredski materijal, 11 stavki',
    amount: 412.8,
    waiting: '2 dana',
    coverage: { state: 'ok', label: 'pokriveno' },
  },
  {
    tab: 'novi',
    number: 'ZN-2026-0186',
    source: 'ponuda',
    requester: 'Luka Marić',
    unit: 'Služba za IT',
    subject: 'Poslužitelj, nadogradnja RAM-a',
    amount: 2140,
    waiting: '2 dana',
    coverage: { state: 'missing', label: 'nema predložene kategorije' },
  },
  {
    tab: 'novi',
    number: 'ZN-2026-0185',
    source: 'ponuda',
    requester: 'Ivana Šarić',
    unit: 'Projekt IPA-2025-09',
    subject: 'Prijevod i lektura, 40 str.',
    amount: 960,
    waiting: '1 dan',
    coverage: { state: 'warn', label: 'projekt istječe 31.10.' },
  },
  {
    tab: 'novi',
    number: 'ZN-2026-0184',
    source: 'ponuda',
    requester: 'Ivan Horvat',
    unit: 'Služba za IT',
    subject: 'Prijenosno računalo 14"',
    amount: 1449,
    waiting: '1 dan',
    coverage: { state: 'ok', label: 'pokriveno' },
  },
  {
    tab: 'novi',
    number: 'ZN-2026-0183',
    source: 'katalog',
    requester: 'Marija Novak',
    unit: 'Služba za računovodstvo',
    subject: 'Toneri, 4 stavke',
    amount: 318.5,
    waiting: '1 dan',
    coverage: { state: 'ok', label: 'pokriveno' },
  },
  {
    tab: 'novi',
    number: 'ZN-2026-0182',
    source: 'ponuda',
    requester: 'Tomislav Jurić',
    unit: 'Služba za tehničke poslove',
    subject: 'Servis klima uređaja',
    amount: 1180,
    waiting: 'danas',
    coverage: { state: 'ok', label: 'pokriveno' },
  },
  {
    tab: 'u-obradi',
    number: 'ZN-2026-0179',
    source: 'ponuda',
    requester: 'Nikolina Perić',
    unit: 'Služba za nastavu',
    subject: 'Projektor za predavaonicu',
    amount: 2380,
    waiting: '4 dana',
    coverage: { state: 'ok', label: 'pokriveno' },
  },
  {
    tab: 'u-obradi',
    number: 'ZN-2026-0176',
    source: 'katalog',
    requester: 'Ivan Horvat',
    unit: 'Služba za IT',
    subject: 'Mrežni preklopnik, 24 porta',
    amount: 890,
    waiting: '6 dana',
    coverage: { state: 'warn', label: 'kategorija na 92 %' },
  },
  {
    tab: 'ceka-dopunu',
    number: 'ZN-2026-0171',
    source: 'ponuda',
    requester: 'Ana Kovač',
    unit: 'Projekt HORIZON-4412',
    subject: 'Laboratorijski potrošni materijal',
    amount: 640.2,
    waiting: '9 dana',
    coverage: { state: 'missing', label: 'nema predložene kategorije' },
  },
  {
    tab: 'ceka-dopunu',
    number: 'ZN-2026-0168',
    source: 'ponuda',
    requester: 'Petar Babić',
    unit: 'Služba za nastavu',
    subject: 'Uvez skripata',
    amount: 275,
    waiting: '12 dana',
    coverage: { state: 'ok', label: 'pokriveno' },
  },
]

const tab = ref('novi')
const selected = ref([])
const pagination = ref({ page: 1, rowsPerPage: 5 })

const visibleRows = computed(() =>
  tab.value === 'svi' ? rows : rows.filter((row) => row.tab === tab.value),
)

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

// promjena skupine krece od prve stranice i bez zaostalih kvacica
watch(tab, () => {
  pagination.value.page = 1
  selected.value = []
})
</script>

<style scoped>
/* ista visina kao zaglavlje ladice, pa sadrzaj krece u ravnini s njezinom crtom */
.page-header {
  height: var(--gimmi-drawer-header);
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

/* zahtjev bez kategorije je praznina, ne podatak - zato isprekidani okvir */
.coverage-chip--missing {
  border-style: dashed;
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
