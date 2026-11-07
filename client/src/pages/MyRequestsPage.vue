<template>
  <q-page padding>
    <div class="row q-col-gutter-md q-mb-lg">
      <div v-for="entry in entryCards" :key="entry.title" class="col-12 col-md-6">
        <q-card flat bordered class="full-height">
          <q-card-section class="row no-wrap items-start q-gutter-md">
            <q-avatar square size="42px" color="grey-3" text-color="grey-8" :icon="entry.icon" />

            <div>
              <div class="text-subtitle1">{{ entry.title }}</div>
              <div class="text-body2 text-grey-7">{{ entry.caption }}</div>
              <q-btn
                outline
                color="primary"
                class="q-mt-md"
                :label="entry.action"
                :to="entry.to"
                @click="entry.onClick?.()"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>

    <div v-if="loading" class="row justify-center q-py-xl">
      <q-spinner color="primary" size="36px" />
    </div>

    <!-- novi korisnik nema nijedan zahtjev pa vidi samo dvije kartice gore -->
    <template v-else-if="requests.length > 0">
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
        flat
        bordered
        square
        :rows="visibleRequests"
        :columns="columns"
        row-key="id_purchase_request"
        hide-pagination
        :rows-per-page-options="[0]"
        no-data-label="Nema zahtjeva u ovoj skupini"
      >
        <template #body-cell-number="props">
          <q-td :props="props" class="text-weight-medium">{{ props.row.request_number }}</q-td>
        </template>

        <template #body-cell-subject="props">
          <q-td :props="props">
            <div>{{ props.row.justification || '—' }}</div>
            <div class="text-caption text-grey-7">
              {{ props.row.source === 'OFFER' ? 'iz ponude' : 'iz kataloga' }}
              <template v-if="props.row.assigned_to_name">
                · {{ props.row.assigned_to_name }}
              </template>
            </div>
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
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props" class="text-right">
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              :label="props.row.status_code === 'DRAFT' ? 'Uredi' : 'Otvori'"
              :to="`/zahtjevi/${props.row.id_purchase_request}`"
            />
          </q-td>
        </template>
      </q-table>
    </template>

    <!-- proba toka: dokument se nigdje ne salje ni ne sprema -->
    <!-- skriveni odabir datoteke; ponudu dalje cita stranica novog zahtjeva -->
    <input
      ref="offerInput"
      type="file"
      accept="application/pdf"
      multiple
      class="hidden"
      @change="onOfferPicked"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { gimmiApi } from 'src/services/gimmi-api'
import { handOverOffers } from 'src/services/offer-handoff'

const route = useRoute()
const router = useRouter()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })
const dateFormat = new Intl.DateTimeFormat('hr-HR')

const entryCards = [
  {
    title: 'Imam ponudu dobavljača',
    caption: 'Priložite PDF ili sliku ponude i mi prepišemo stavke',
    icon: 'description',
    action: 'Podnesi iz ponude',
    onClick: () => pickOffer(),
  },
  {
    title: 'Ne znam gdje kupiti',
    caption: 'Odaberite iz kataloga s već ugovorenim cijenama',
    icon: 'menu_book',
    action: 'Otvori katalog',
    to: '/katalog',
  },
]

// Tabovi grupiraju statuse: sve sto je u tijeku ide u "U obradi".
const tabs = [
  { name: 'u-obradi', label: 'U obradi' },
  { name: 'zavrseni', label: 'Završeni' },
  { name: 'nacrti', label: 'Nacrti' },
  { name: 'odbijeni', label: 'Odbijeni' },
]

const tabForStatus = {
  DRAFT: 'nacrti',
  SUBMITTED: 'u-obradi',
  IN_PROGRESS: 'u-obradi',
  NEEDS_INFO: 'u-obradi',
  APPROVED: 'u-obradi',
  ORDERED: 'u-obradi',
  RECEIVED: 'u-obradi',
  CLOSED: 'zavrseni',
  REJECTED: 'odbijeni',
}

const statusColors = {
  DRAFT: 'grey-7',
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
  { name: 'subject', label: 'Predmet', field: 'justification', align: 'left' },
  {
    name: 'amount',
    label: 'Iznos',
    field: 'total_amount',
    align: 'right',
    format: (value) => currencyFormat.format(value ?? 0),
  },
  {
    name: 'createdAt',
    label: 'Podnesen',
    field: 'created_at',
    align: 'left',
    format: (value) => dateFormat.format(new Date(value)),
  },
  { name: 'status', label: 'Status', field: 'status_name', align: 'left' },
  { name: 'action', label: '', field: 'id_purchase_request', align: 'right' },
]

const requests = ref([])
const loading = ref(true)
const error = ref(null)
// ruta moze odmah otvoriti odredjeni tab (npr. /nacrti)
const tab = ref(route.meta.tab ?? 'u-obradi')

const visibleRequests = computed(() =>
  requests.value.filter((request) => tabForStatus[request.status_code] === tab.value),
)

function countFor(name) {
  return requests.value.filter((request) => tabForStatus[request.status_code] === name).length
}

async function load() {
  loading.value = true
  error.value = null

  try {
    requests.value = await gimmiApi.getMyPurchaseRequests()

    // ako ruta ne trazi odredjeni tab, otvori onaj u kojem zahtjeva ima
    if (route.meta.tab === undefined) {
      const firstWithRows = tabs.find((item) => countFor(item.name) > 0)

      if (firstWithRows) {
        tab.value = firstWithRows.name
      }
    }
  } catch (err) {
    error.value = err.response?.data?.error ?? `Dohvat zahtjeva nije uspio: ${err.message}`
  } finally {
    loading.value = false
  }
}

onMounted(load)

const offerInput = ref(null)

function pickOffer() {
  offerInput.value.value = ''
  offerInput.value.click()
}

function onOfferPicked(event) {
  const files = [...(event.target.files ?? [])]

  if (files.length === 0) {
    return
  }

  handOverOffers(files)
  router.push('/zahtjevi/novi')
}
</script>
