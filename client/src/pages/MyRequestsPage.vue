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
    <q-dialog v-model="offerDialog" persistent>
      <q-card style="min-width: 380px">
        <q-card-section class="text-subtitle1">Podnesi iz ponude</q-card-section>

        <q-card-section v-if="uploading" class="column items-center q-gutter-md q-py-lg">
          <q-spinner color="primary" size="48px" />
          <div class="text-body2 text-grey-7">Obrađujem ponudu...</div>
        </q-card-section>

        <template v-else>
          <q-card-section class="q-pt-none">
            <q-file
              v-model="offerFile"
              outlined
              dense
              label="Odaberite dokument"
              accept=".pdf,.doc,.docx,image/*"
            >
              <template #prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>

            <div class="text-caption text-grey-7 q-mt-sm">
              Dokument ostaje samo u pregledniku, nigdje se ne sprema.
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn v-close-popup flat label="Odustani" />
            <q-btn
              unelevated
              color="primary"
              label="Učitaj"
              :disable="offerFile === null"
              @click="startUpload"
            />
          </q-card-actions>
        </template>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import { gimmiApi } from 'src/services/gimmi-api'

const $q = useQuasar()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })
const dateFormat = new Intl.DateTimeFormat('hr-HR')

const entryCards = [
  {
    title: 'Imam ponudu dobavljača',
    caption: 'Priložite PDF ili sliku ponude i mi prepišemo stavke',
    icon: 'description',
    action: 'Podnesi iz ponude',
    onClick: () => openOfferDialog(),
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
const tab = ref('u-obradi')

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

    // otvori tab u kojem zahtjevi zaista postoje
    const firstWithRows = tabs.find((item) => countFor(item.name) > 0)
    if (firstWithRows) {
      tab.value = firstWithRows.name
    }
  } catch (err) {
    error.value = err.response?.data?.error ?? `Dohvat zahtjeva nije uspio: ${err.message}`
  } finally {
    loading.value = false
  }
}

onMounted(load)

const offerDialog = ref(false)
const offerFile = ref(null)
const uploading = ref(false)

let uploadTimer = null

function openOfferDialog() {
  offerFile.value = null
  uploading.value = false
  offerDialog.value = true
}

// Lazna obrada od 30 sekundi, dok se ne napravi prava obrada ponude.
function startUpload() {
  uploading.value = true

  uploadTimer = setTimeout(() => {
    uploading.value = false
    offerDialog.value = false

    $q.notify({
      type: 'positive',
      message: 'Ponuda je obrađena.',
      caption: offerFile.value?.name,
    })
  }, 30000)
}

onBeforeUnmount(() => clearTimeout(uploadTimer))
</script>
