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

    <!-- novi korisnik nema nijedan zahtjev pa vidi samo dvije kartice gore -->
    <template v-if="requests.length > 0">
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
        row-key="number"
        hide-pagination
        :rows-per-page-options="[0]"
        no-data-label="Nema zahtjeva u ovoj skupini"
      >
        <template #body-cell-number="props">
          <q-td :props="props" class="text-weight-medium">{{ props.row.number }}</q-td>
        </template>

        <template #body-cell-subject="props">
          <q-td :props="props">
            <div>{{ props.row.subject }}</div>
            <div v-if="props.row.source" class="text-caption text-grey-7">
              {{ props.row.source }}
            </div>
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <q-chip
              dense
              outline
              :color="statusColors[props.row.status] ?? 'grey-7'"
              :label="props.row.status"
            />
            <div v-if="props.row.note" class="text-caption text-grey-7">{{ props.row.note }}</div>
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props" class="text-right">
            <q-btn outline dense no-caps color="primary" :label="props.row.action" />
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
import { computed, onBeforeUnmount, ref } from 'vue'
import { useQuasar } from 'quasar'

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

const tabs = [
  { name: 'u-obradi', label: 'U obradi' },
  { name: 'zavrseni', label: 'Završeni' },
  { name: 'nacrti', label: 'Nacrti' },
  { name: 'odbijeni', label: 'Odbijeni' },
]

const statusColors = {
  'U obradi': 'blue-8',
  'Čeka dopunu': 'orange-9',
  Naručen: 'teal-8',
  Nacrt: 'grey-7',
}

// Placeholder podaci - kasnije dolaze s /api/purchase-requests.
const requests = [
  {
    number: 'ZN-2026-0184',
    subject: 'Prijenosno računalo 14"',
    source: 'iz ponude · Links d.o.o.',
    amount: 1449,
    submittedAt: '2026-09-04',
    status: 'U obradi',
    action: 'Otvori',
    tab: 'u-obradi',
  },
  {
    number: 'ZN-2026-0179',
    subject: 'Toner HP 216A, 4 kom',
    source: 'iz kataloga',
    amount: 318.4,
    submittedAt: '2026-08-28',
    status: 'Čeka dopunu',
    action: 'Dopuni',
    tab: 'u-obradi',
  },
  {
    number: 'ZN-2026-0171',
    subject: 'Licenca za statistički paket',
    source: '',
    amount: 890,
    submittedAt: '2026-08-19',
    status: 'Naručen',
    note: 'dostava do 22.09.',
    action: 'Otvori',
    tab: 'u-obradi',
  },
  {
    number: 'ZN-2026-0190',
    subject: 'Uredski stolac',
    source: 'iz kataloga',
    amount: 245,
    submittedAt: '2026-09-12',
    status: 'Nacrt',
    action: 'Uredi',
    tab: 'nacrti',
  },
]

const columns = [
  { name: 'number', label: 'Zahtjev', field: 'number', align: 'left' },
  { name: 'subject', label: 'Predmet', field: 'subject', align: 'left' },
  {
    name: 'amount',
    label: 'Iznos',
    field: 'amount',
    align: 'right',
    format: (value) => currencyFormat.format(value),
  },
  {
    name: 'submittedAt',
    label: 'Podnesen',
    field: 'submittedAt',
    align: 'left',
    format: (value) => dateFormat.format(new Date(value)),
  },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'action', label: '', field: 'action', align: 'right' },
]

const tab = ref('u-obradi')

const visibleRequests = computed(() => requests.filter((request) => request.tab === tab.value))

function countFor(name) {
  return requests.filter((request) => request.tab === name).length
}

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
