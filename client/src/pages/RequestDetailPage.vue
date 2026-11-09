<template>
  <q-page class="bg-grey-2 with-page-header">
    <div class="page-header row items-center no-wrap q-px-lg q-gutter-sm">
      <q-btn flat dense no-caps color="grey-7" icon="arrow_back" label="Natrag" @click="goBack" />

      <template v-if="request">
        <div class="text-subtitle1 text-weight-bold q-ml-md">{{ request.request_number }}</div>

        <q-chip
          dense
          outline
          :color="statusColors[request.status_code] ?? 'grey-7'"
          :label="request.status_name"
        />

        <q-space />

        <q-btn
          v-if="request.can_edit"
          outline
          no-caps
          color="primary"
          icon="edit"
          :label="request.status_code === 'NEEDS_INFO' ? 'Dopuni' : 'Uredi'"
          :to="`/zahtjevi/${request.id_purchase_request}/uredi`"
        />

        <!-- samo koraci koje prijavljeni korisnik smije napraviti -->
        <q-btn
          v-for="step in allowedTransitions"
          :key="step.code"
          no-caps
          :outline="!isPrimaryStep(step)"
          :unelevated="isPrimaryStep(step)"
          :color="stepColors[step.code] ?? 'primary'"
          :label="stepLabels[step.code] ?? step.name"
          @click="openTransition(step)"
        />
      </template>
    </div>

    <div class="q-px-lg q-pb-lg">
      <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>

      <div v-if="loading" class="row justify-center q-py-xl">
        <q-spinner color="primary" size="36px" />
      </div>

      <div v-else-if="request" class="row q-col-gutter-md">
        <div class="col-12 col-md">
          <!-- Tko trazi, na ciji trosak i zasto. -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="row q-col-gutter-md">
              <div v-for="fact in facts" :key="fact.label" class="col-6 col-sm-4">
                <div class="fact-label">{{ fact.label }}</div>
                <div class="text-body2">{{ fact.value }}</div>
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div class="fact-label">Svrha nabave</div>
              <div class="text-body1 pre-line">{{ request.justification || '—' }}</div>

              <template v-if="request.comment">
                <div class="fact-label q-mt-md">Napomena operateru</div>
                <div class="text-body2 pre-line">{{ request.comment }}</div>
              </template>
            </q-card-section>
          </q-card>

          <q-table
            flat
            bordered
            square
            :rows="request.items"
            :columns="itemColumns"
            row-key="id_purchase_request_item"
            hide-pagination
            :rows-per-page-options="[0]"
            no-data-label="Zahtjev nema stavki"
            class="bg-white"
          >
            <template #top>
              <div class="text-subtitle1 text-weight-bold">Stavke</div>
            </template>

            <!-- nabava bira kategoriju dok o zahtjevu jos nije odluceno -->
            <template #body-cell-category="props">
              <q-td :props="props" class="category-cell">
                <q-select
                  v-if="canEditCategories"
                  :model-value="props.row.fk_item_category_budget"
                  dense
                  outlined
                  emit-value
                  map-options
                  clearable
                  options-dense
                  placeholder="Odaberite"
                  :options="categoryOptions"
                  :loading="savingItem === props.row.id_purchase_request_item"
                  :class="{ 'category-missing': props.row.fk_item_category_budget === null }"
                  @update:model-value="(value) => setCategory(props.row, value)"
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

                <span v-else :class="{ 'text-grey-6': !props.row.item_category_name }">
                  {{ props.row.item_category_name ?? 'bez kategorije' }}
                </span>
              </q-td>
            </template>

            <template #bottom-row>
              <q-tr v-for="total in totals" :key="total.label" class="total-row">
                <q-td colspan="4" class="text-right text-grey-7">{{ total.label }}</q-td>
                <q-td class="text-right num" :class="{ 'text-weight-bold': total.strong }">
                  {{ currencyFormat.format(total.value ?? 0) }}
                </q-td>
                <q-td />
              </q-tr>
            </template>
          </q-table>

          <!-- koliko kategorijama ostaje kad se ovaj zahtjev odobri -->
          <q-card v-if="budgetRows.length > 0" flat bordered class="q-mt-md">
            <q-card-section class="text-subtitle1 text-weight-bold q-pb-none">
              Proračun po kategorijama
            </q-card-section>

            <q-card-section class="q-gutter-md">
              <div v-for="row in budgetRows" :key="row.id">
                <div class="row items-baseline no-wrap q-mb-xs">
                  <div class="col text-body2 text-weight-medium ellipsis">{{ row.name }}</div>
                  <div
                    class="text-body2 num"
                    :class="row.after < 0 ? 'text-negative' : 'text-grey-8'"
                  >
                    {{
                      row.after < 0
                        ? `nedostaje ${currencyFormat.format(-row.after)}`
                        : `ostaje ${currencyFormat.format(row.after)}`
                    }}
                  </div>
                </div>

                <q-linear-progress
                  rounded
                  size="8px"
                  :value="Math.min(row.share, 1)"
                  :color="row.share > 1 ? 'negative' : row.share > 0.9 ? 'orange-8' : 'primary'"
                  track-color="grey-3"
                />

                <div class="text-caption text-grey-7 q-mt-xs num">
                  limit {{ currencyFormat.format(row.limit) }} · već odobreno
                  {{ currencyFormat.format(row.others) }} · ovaj zahtjev
                  {{ currencyFormat.format(row.amount) }} s PDV-om
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-4 side-column">
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="row items-center q-pb-sm">
              <div class="text-subtitle1 text-weight-bold">Prilozi</div>
              <q-space />
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                icon="attach_file"
                label="Priloži"
                @click="openAttach()"
              />
            </q-card-section>

            <q-list v-if="currentAttachments.length > 0" separator>
              <q-item
                v-for="file in currentAttachments"
                :key="file.id_purchase_request_attachment"
                clickable
                tag="a"
                target="_blank"
                rel="noopener"
                :href="
                  gimmiApi.attachmentUrl(
                    request.id_purchase_request,
                    file.id_purchase_request_attachment,
                  )
                "
              >
                <q-item-section avatar>
                  <q-icon
                    :name="file.is_generated ? 'auto_awesome' : 'description'"
                    color="grey-7"
                  />
                </q-item-section>

                <q-item-section>
                  <q-item-label class="ellipsis">{{ file.file_name }}</q-item-label>
                  <q-item-label caption>
                    {{ file.document_type_name }}
                    <span v-if="file.version > 1">· verzija {{ file.version }}</span>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>

            <q-card-section v-else class="text-body2 text-grey-7 q-pt-none">
              Nema priloženih dokumenata.
            </q-card-section>
          </q-card>

          <q-card flat bordered>
            <q-card-section class="text-subtitle1 text-weight-bold q-pb-none"
              >Povijest</q-card-section
            >

            <q-card-section>
              <q-timeline v-if="request.timeline.length > 0" dense color="grey-6" class="q-my-none">
                <q-timeline-entry
                  v-for="event in request.timeline"
                  :key="`${event.event}-${event.sort_id}`"
                  :icon="event.event === 'STATUS' ? 'flag' : 'description'"
                  :subtitle="`${dateTimeFormat.format(new Date(event.happened_at))} · ${event.by_name}`"
                >
                  <template #title>
                    <span class="text-body2 text-weight-medium">{{ eventTitle(event) }}</span>
                  </template>

                  <div v-if="event.comment" class="text-body2 text-grey-8 pre-line">
                    {{ event.comment }}
                  </div>
                </q-timeline-entry>
              </q-timeline>

              <div v-else class="text-body2 text-grey-7">Još se ništa nije dogodilo.</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Potvrda koraka: komentar i trazeni dokument, ako ih pravilo trazi. -->
    <q-dialog v-model="transitionDialog" @hide="pendingStep = null">
      <q-card v-if="pendingStep" style="width: 480px; max-width: 90vw">
        <q-card-section class="text-h6">{{
          stepLabels[pendingStep.code] ?? pendingStep.name
        }}</q-card-section>

        <q-card-section class="q-pt-none q-gutter-md">
          <div class="text-body2 text-grey-8">
            Zahtjev {{ request.request_number }} prelazi u status <b>{{ pendingStep.name }}</b
            >.
          </div>

          <q-banner v-if="missingDocument" dense class="bg-orange-1 text-orange-10">
            Za ovaj korak treba priložiti dokument:
            {{ documentTypeName(pendingStep.required_document_type_code) }}.
            <template #action>
              <q-btn
                flat
                dense
                no-caps
                color="orange-10"
                label="Priloži"
                @click="openAttach(pendingStep.required_document_type_code)"
              />
            </template>
          </q-banner>

          <q-input
            v-model="transitionComment"
            outlined
            autogrow
            type="textarea"
            :label="
              pendingStep.requires_comment ? 'Komentar (obavezno)' : 'Komentar (nije obavezno)'
            "
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps color="grey-8" label="Odustani" />
          <q-btn
            unelevated
            no-caps
            :color="stepColors[pendingStep.code] ?? 'primary'"
            label="Potvrdi"
            :loading="saving"
            :disable="!canConfirm"
            @click="confirmTransition"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="attachDialog">
      <q-card style="width: 440px; max-width: 90vw">
        <q-card-section class="text-h6">Priloži dokument</q-card-section>

        <q-card-section class="q-pt-none q-gutter-md">
          <q-select
            v-model="attachType"
            outlined
            emit-value
            map-options
            label="Vrsta dokumenta"
            :options="documentTypeOptions"
          />

          <q-file
            v-model="attachFile"
            outlined
            label="Datoteka"
            accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps color="grey-8" label="Odustani" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Priloži"
            :loading="uploading"
            :disable="!attachFile || !attachType"
            @click="uploadAttachment"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import { gimmiApi } from 'src/services/gimmi-api'
import { useAuthStore } from 'stores/auth'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })
const dateFormat = new Intl.DateTimeFormat('hr-HR')
const dateTimeFormat = new Intl.DateTimeFormat('hr-HR', { dateStyle: 'short', timeStyle: 'short' })
const numberFormat = new Intl.NumberFormat('hr-HR')

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

// Gumb kaze sto korisnik radi, a ne u koji status zahtjev ide.
const stepLabels = {
  SUBMITTED: 'Podnesi',
  IN_PROGRESS: 'Preuzmi',
  NEEDS_INFO: 'Traži dopunu',
  APPROVED: 'Odobri',
  REJECTED: 'Odbij',
  ORDERED: 'Naručeno',
  RECEIVED: 'Zaprimljeno',
  CLOSED: 'Zaključi',
}

const stepColors = {
  NEEDS_INFO: 'orange-9',
  REJECTED: 'red-8',
}

const documentTypes = {
  OFFER: 'Ponuda',
  REQUEST: 'Zahtjev za nabavom',
  PURCHASE_ORDER: 'Narudžbenica',
  DELIVERY_NOTE: 'Dostavnica',
  OTHER: 'Ostali prilog',
}

// zahtjev za nabavom generira sustav, pa se ne nudi za rucno prilaganje
const documentTypeOptions = Object.entries(documentTypes)
  .filter(([code]) => code !== 'REQUEST')
  .map(([value, label]) => ({ value, label }))

const itemColumns = [
  { name: 'name', label: 'Naziv', field: 'item_name', align: 'left' },
  {
    name: 'quantity',
    label: 'Količina',
    field: 'quantity',
    align: 'right',
    format: (value) => numberFormat.format(value),
  },
  {
    name: 'unitPrice',
    label: 'Jed. cijena',
    field: 'unit_price',
    align: 'right',
    format: (value) => (value === null ? '—' : currencyFormat.format(value)),
  },
  {
    name: 'vat',
    label: 'PDV',
    field: 'vat_rate',
    align: 'right',
    format: (value) => (value === null ? '—' : `${numberFormat.format(value)} %`),
  },
  {
    name: 'lineTotal',
    label: 'Iznos bez PDV-a',
    field: 'line_total',
    align: 'right',
    format: (value) => (value === null ? '—' : currencyFormat.format(value)),
  },
  {
    name: 'category',
    label: 'Kategorija',
    field: 'item_category_name',
    align: 'left',
    format: (value) => value ?? '—',
  },
]

const request = ref(null)
const loading = ref(true)
const error = ref(null)

// ponovno ucitavanje nakon izmjene ne skriva stranicu iza spinnera
async function load() {
  loading.value = request.value?.id_purchase_request !== Number(route.params.id)
  error.value = null

  try {
    request.value = await gimmiApi.getPurchaseRequest(route.params.id)
  } catch (err) {
    request.value = null
    error.value = err.response?.data?.error ?? `Dohvat zahtjeva nije uspio: ${err.message}`
  } finally {
    loading.value = false
  }
}

// ista komponenta ostaje kad se prijedje s jednog zahtjeva na drugi
watch(() => route.params.id, load, { immediate: true })

const facts = computed(() => [
  { label: 'Podnositelj', value: request.value.created_by_name },
  { label: 'Služba ili projekt', value: request.value.department_name },
  { label: 'Podnesen', value: dateFormat.format(new Date(request.value.created_at)) },
  { label: 'Izvor', value: request.value.source === 'OFFER' ? 'ponuda' : 'katalog' },
  { label: 'Fiskalna godina', value: request.value.year },
  { label: 'Obrađuje', value: request.value.assigned_to_name ?? 'nitko još' },
])

const totals = computed(() => [
  { label: 'Ukupno bez PDV-a', value: request.value.net_amount },
  { label: 'PDV', value: request.value.vat_amount },
  { label: 'Ukupno', value: request.value.total_amount, strong: true },
])

// isti popis kao COMMITTED_STATUSES na serveru (budget.js)
const committedStatuses = ['APPROVED', 'ORDERED', 'RECEIVED', 'CLOSED']

const canEditCategories = computed(
  () =>
    request.value?.category_editable === true && (auth.isAdmin || auth.roleCode === 'PROCUREMENT'),
)

const categoryOptions = computed(() =>
  (request.value?.categories ?? [])
    .filter((cat) => cat.is_active === 1)
    .map((cat) => ({
      value: cat.id_item_category_budget,
      label: cat.name,
      caption: `slobodno ${currencyFormat.format(cat.budget_limit - cat.committed_amount)}`,
    })),
)

// Zbroj zahtjeva po kategoriji naspram onoga sto je vec odobreno. Odobreni
// zahtjev je vec u odobrenom iznosu, pa se njegov dio oduzima.
const budgetRows = computed(() => {
  if (!request.value) {
    return []
  }

  const amounts = new Map()

  for (const item of request.value.items) {
    if (item.fk_item_category_budget !== null) {
      amounts.set(
        item.fk_item_category_budget,
        (amounts.get(item.fk_item_category_budget) ?? 0) + Number(item.line_gross),
      )
    }
  }

  const isCommitted = committedStatuses.includes(request.value.status_code)

  return [...amounts].map(([id, amount]) => {
    const cat = request.value.categories.find((other) => other.id_item_category_budget === id)
    const limit = Number(cat?.budget_limit ?? 0)
    const others = Number(cat?.committed_amount ?? 0) - (isCommitted ? amount : 0)

    return {
      id,
      name: cat?.name ?? `kategorija ${id}`,
      limit,
      others,
      amount,
      after: limit - others - amount,
      share: limit > 0 ? (others + amount) / limit : Infinity,
    }
  })
})

const savingItem = ref(null)

async function setCategory(item, category) {
  savingItem.value = item.id_purchase_request_item

  try {
    await gimmiApi.setItemCategory(
      request.value.id_purchase_request,
      item.id_purchase_request_item,
      category ?? null,
    )
    await load()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.response?.data?.error ?? err.message })
  } finally {
    savingItem.value = null
  }
}

const currentAttachments = computed(() =>
  request.value.attachments.filter((file) => file.is_current === 1),
)

// Server vraca sve prijelaze iz trenutnog statusa; ovdje ostaju oni koje
// prijavljeni korisnik smije napraviti (administrator smije sve).
const allowedTransitions = computed(() =>
  (request.value?.transitions ?? []).filter(
    (step) =>
      auth.isAdmin || step.allowed_role_code === null || step.allowed_role_code === auth.roleCode,
  ),
)

// odbijanje i dopuna su sporedni koraci, ostali vode zahtjev naprijed
function isPrimaryStep(step) {
  return !['NEEDS_INFO', 'REJECTED'].includes(step.code)
}

function documentTypeName(code) {
  return documentTypes[code] ?? code
}

function eventTitle(event) {
  if (event.event === 'STATUS') {
    return event.status_name
  }

  const verb = event.event === 'DOCUMENT_GENERATED' ? 'Izrađen' : 'Priložen'

  return `${verb}: ${event.document_type_name}${event.version > 1 ? ` (v${event.version})` : ''}`
}

function goBack() {
  // vue-router pamti odakle se doslo; bez toga ide na popis zahtjeva
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/zahtjevi')
  }
}

const transitionDialog = ref(false)
const pendingStep = ref(null)
const transitionComment = ref('')
const saving = ref(false)

const missingDocument = computed(() => {
  const code = pendingStep.value?.required_document_type_code

  return Boolean(code) && !currentAttachments.value.some((file) => file.document_type_code === code)
})

const canConfirm = computed(
  () =>
    !missingDocument.value &&
    (!pendingStep.value?.requires_comment || transitionComment.value.trim() !== ''),
)

function openTransition(step) {
  pendingStep.value = step
  transitionComment.value = ''
  transitionDialog.value = true
}

async function confirmTransition() {
  saving.value = true

  try {
    await gimmiApi.changePurchaseRequestStatus(
      request.value.id_purchase_request,
      pendingStep.value.code,
      transitionComment.value.trim() || null,
    )

    $q.notify({ type: 'positive', message: `Zahtjev je sada: ${pendingStep.value.name}` })
    transitionDialog.value = false
    await load()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.response?.data?.error ?? err.message })
  } finally {
    saving.value = false
  }
}

const attachDialog = ref(false)
const attachType = ref(null)
const attachFile = ref(null)
const uploading = ref(false)

function openAttach(type = null) {
  attachType.value = type ?? 'OTHER'
  attachFile.value = null
  attachDialog.value = true
}

async function uploadAttachment() {
  uploading.value = true

  try {
    await gimmiApi.addAttachment(
      request.value.id_purchase_request,
      attachFile.value,
      attachType.value,
    )

    $q.notify({
      type: 'positive',
      message: 'Dokument je priložen.',
      caption: attachFile.value.name,
    })
    attachDialog.value = false
    await load()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.response?.data?.error ?? err.message })
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.page-header {
  min-height: 64px;
}

.fact-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.55);
  margin-bottom: 2px;
}

.pre-line {
  white-space: pre-line;
}

.num {
  font-variant-numeric: tabular-nums;
}

.category-cell {
  min-width: 200px;
}

/* stavka bez kategorije je praznina koju treba popuniti */
.category-missing :deep(.q-field__control:before) {
  border-style: dashed;
  border-color: var(--q-orange-8, #ef6c00);
}

.total-row td {
  border-bottom: none;
}

:deep(th) {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
</style>
