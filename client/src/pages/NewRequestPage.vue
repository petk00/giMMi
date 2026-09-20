<template>
  <q-page class="bg-grey-2 with-page-header">
    <!-- Zaglavlje stoji u traci logotipa, ali bez vlastite pozadine i crte -
         blokovi ispod pocinju tocno na visini crte iz ladice. -->
    <div class="page-header row items-center no-wrap q-px-lg">
      <div class="col row items-center q-gutter-sm text-body2 text-grey-7 ellipsis">
        <span>{{ auth.fullName }}</span>
        <span>·</span>
        <span>{{ today }}</span>
        <span>·</span>
        <span>poslovna godina {{ fiscalYear }}</span>
        <q-chip dense square color="grey-3" text-color="grey-8" label="nacrt" class="meta-chip" />
        <span>·</span>
        <span>broj se dodjeljuje pri spremanju</span>
      </div>

      <q-btn flat dense no-caps color="grey-7" icon="close" label="Odustani" @click="cancel" />
    </div>

    <div class="q-px-lg q-pb-lg">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md-8">
          <!-- obrazlozenje: sto zahtjev trazi i na ciji trosak -->
          <q-card flat bordered class="q-mb-md">
            <!-- svrha lijevo, trosak i napomena desno -->
            <q-card-section class="row q-col-gutter-md">
              <div class="col-12 col-md-6 column">
                <!-- brojac stoji uz oznaku, da polje moze do dna stupca -->
                <div class="row items-baseline q-mb-xs">
                  <div class="field-label col">Svrha nabave</div>
                  <div class="text-caption text-grey-7">
                    {{ justification.length }} / 500 znakova
                  </div>
                </div>

                <q-input
                  v-model="justification"
                  outlined
                  type="textarea"
                  maxlength="500"
                  class="col purpose-field"
                  placeholder="Za koga je, zašto je potrebno i do kada treba stići."
                />
              </div>

              <div class="col-12 col-md-6">
                <div class="field-label q-mb-xs">Služba ili projekt</div>
                <q-select
                  v-model="costCentre"
                  outlined
                  label="Odaberite"
                  :options="costCentreOptions"
                  option-label="label"
                  option-value="id_department_budget"
                  :loading="loadingCostCentres"
                />

                <div class="field-label q-mb-xs q-mt-md">
                  Napomena operateru
                  <span class="text-body2 text-grey-7 text-weight-regular">(nije obavezno)</span>
                </div>
                <q-input
                  v-model="note"
                  outlined
                  placeholder="npr. hitno, zamjena za pokvareno računalo"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- ponuda: jedini ulaz su drag&drop ili klik, ostalo cita model -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="row items-center q-gutter-sm card-title q-pb-sm">
              <div class="text-subtitle1 text-weight-bold">Ponuda</div>
              <div class="text-body2 text-grey-7">{{ offerHint }}</div>
            </q-card-section>

            <q-card-section class="q-pt-none">
              <q-file
                ref="offerPicker"
                v-model="offerFile"
                class="hidden"
                accept=".pdf,image/jpeg,image/png"
              />

              <div
                v-if="offerFile === null"
                class="dropzone column flex-center q-pa-xl cursor-pointer"
                :class="{ 'dropzone--over': dragOver }"
                @click="pickOffer"
                @dragenter.prevent="dragOver = true"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="dropOffer"
              >
                <q-icon name="cloud_upload" size="44px" color="grey-6" />

                <div class="text-subtitle1 q-mt-sm">Povucite ponudu ovdje ili kliknite</div>
                <div class="text-body2 text-grey-7 text-center">
                  PDF, JPG ili PNG; model sam čita dobavljača, stavke i cijene
                </div>
              </div>

              <template v-else>
                <div class="file-row row items-center no-wrap q-gutter-md q-pa-md">
                  <q-avatar square size="40px" class="file-icon">
                    <q-icon :name="offerIcon" size="22px" color="grey-7" />
                  </q-avatar>

                  <div class="col ellipsis">
                    <div class="row items-baseline q-gutter-sm">
                      <span class="text-weight-bold ellipsis">
                        {{ supplier?.name || offerFile.name }}
                      </span>
                      <span v-if="supplier?.offerNumber" class="text-body2 text-grey-8">
                        ponuda {{ supplier.offerNumber }}
                      </span>
                    </div>

                    <div class="text-caption text-grey-7 ellipsis">{{ offerMeta }}</div>

                    <div v-if="supplier !== null" class="row items-center q-gutter-xs q-mt-xs">
                      <q-chip
                        v-if="supplier.oib"
                        dense
                        square
                        color="grey-3"
                        text-color="grey-8"
                        class="meta-chip"
                        :label="`OIB ${supplier.oib}`"
                      />
                      <q-chip
                        v-if="supplier.validUntil"
                        dense
                        square
                        color="orange-1"
                        text-color="orange-9"
                        icon="schedule"
                        class="meta-chip"
                        :label="`vrijedi do ${supplier.validUntil}`"
                      />
                      <q-chip
                        dense
                        square
                        color="blue-1"
                        text-color="blue-9"
                        icon="auto_awesome"
                        class="meta-chip"
                        :label="readLabel"
                      />
                    </div>
                  </div>

                  <div class="col-auto row items-center q-gutter-sm">
                    <q-btn
                      outline
                      no-caps
                      color="primary"
                      icon="visibility"
                      label="Pregledaj"
                      @click="preview"
                    />
                    <q-btn
                      v-if="!reading"
                      flat
                      dense
                      no-caps
                      color="grey-7"
                      icon="refresh"
                      label="Očitaj ponovno"
                      @click="runReading"
                    />
                    <q-btn
                      flat
                      dense
                      no-caps
                      color="grey-7"
                      icon="close"
                      label="Ukloni"
                      @click="removeOffer"
                    />
                  </div>
                </div>

                <div v-if="reading" class="row items-center q-gutter-md q-px-md q-mt-sm">
                  <q-spinner color="primary" size="22px" />
                  <span class="text-body2 text-grey-7">Model čita ponudu...</span>
                </div>

                <q-banner v-else-if="readError" dense class="bg-red-1 text-grey-9 q-mt-sm">
                  <template #avatar>
                    <q-icon name="error_outline" color="red-9" />
                  </template>

                  {{ readError }}
                </q-banner>
              </template>
            </q-card-section>
          </q-card>

          <!-- stavke: blok postoji tek kad model nesto izvuce iz ponude -->
          <q-card v-if="items.length > 0" flat bordered>
            <q-card-section class="row items-center q-gutter-sm q-pb-none">
              <div class="text-subtitle1 text-weight-bold">Stavke</div>
              <q-chip
                v-if="offerItemCount > 0"
                dense
                square
                color="blue-1"
                text-color="blue-9"
                icon="auto_awesome"
              >
                {{ offerItemCount }} očitano iz ponude
              </q-chip>
            </q-card-section>

            <q-card-section class="text-body2 text-grey-7 q-py-sm">
              Kategorija određuje konto na koji trošak ide. Provjeri označeno prije slanja — nakon
              podnošenja stavke više ne možeš mijenjati.
            </q-card-section>

            <q-card-section class="q-gutter-md q-pt-none">
              <div v-for="(item, index) in items" :key="index" class="item-card q-pa-md">
                <div class="row items-center no-wrap q-gutter-sm">
                  <div class="col text-weight-bold">{{ item.name }}</div>
                  <div class="text-caption text-grey-7">{{ item.source }}</div>
                  <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    icon="close"
                    color="grey-7"
                    @click="items.splice(index, 1)"
                  />
                </div>

                <div class="row items-center q-col-gutter-sm q-mt-sm">
                  <div class="col-auto text-body2 text-grey-8">Kol.</div>
                  <div class="col-auto">
                    <q-input
                      v-model.number="item.quantity"
                      outlined
                      dense
                      type="number"
                      min="1"
                      style="width: 84px"
                    />
                  </div>

                  <div class="col-auto text-grey-6">×</div>

                  <div class="col-auto text-body2 text-grey-8">Cijena</div>
                  <div class="col-auto">
                    <q-input
                      v-model.number="item.unitPrice"
                      outlined
                      dense
                      type="number"
                      step="0.01"
                      style="width: 120px"
                    />
                  </div>

                  <div class="col-auto text-grey-6">=</div>
                  <div class="col-auto text-weight-bold num">
                    {{ money(item.quantity * item.unitPrice) }}
                  </div>

                  <q-space />

                  <div class="col-auto text-body2 text-grey-8">Kategorija</div>
                  <div class="col-auto">
                    <q-select
                      v-model="item.category"
                      outlined
                      dense
                      options-dense
                      :options="categoryOptions"
                      option-label="label"
                      :loading="loadingCategories"
                      label="Odaberite"
                      style="min-width: 260px"
                    />
                  </div>
                </div>
              </div>

              <q-btn
                flat
                no-caps
                color="grey-8"
                icon="add"
                label="Dodaj stavku koje nema na ponudi"
                class="add-item full-width"
                @click="addItem"
              />
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div class="row items-center justify-between q-py-xs">
                <div class="row items-center q-gutter-sm">
                  <span class="text-grey-8">Osnovica</span>
                  <q-chip
                    v-if="supplier === null"
                    dense
                    square
                    color="grey-3"
                    text-color="grey-8"
                    label="nema ponude za usporedbu"
                    class="meta-chip"
                  />
                  <q-chip
                    v-else-if="matchesOffer"
                    dense
                    square
                    color="green-1"
                    text-color="green-9"
                    icon="check"
                    label="odgovara iznosu na ponudi"
                    class="meta-chip"
                  />
                  <q-chip
                    v-else
                    dense
                    square
                    color="red-1"
                    text-color="red-9"
                    icon="error"
                    label="ne odgovara iznosu na ponudi"
                    class="meta-chip"
                  />
                </div>
                <span class="num">{{ money(itemsTotal) }}</span>
              </div>

              <div class="row items-center justify-between q-py-xs">
                <span class="text-grey-8">PDV {{ vatRate }} %</span>
                <span class="num">{{ money(vatAmount) }}</span>
              </div>

              <q-separator class="q-my-sm" />

              <div class="row items-center justify-between text-weight-bold text-h6">
                <span>Ukupno s PDV-om</span>
                <span class="num">{{ money(grossTotal) }}</span>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- desno: provjera prije slanja i sto slijedi -->
        <div class="col-12 col-md-4">
          <div class="side-column">
            <q-card flat bordered class="q-mb-md">
              <q-card-section class="row items-center card-title q-pb-sm">
                <div class="text-subtitle1 text-weight-bold">Prije slanja</div>
              </q-card-section>

              <q-list>
                <q-item v-for="check in checklist" :key="check.label">
                  <q-item-section avatar class="check-avatar">
                    <q-icon
                      :name="check.done ? 'check_circle' : 'radio_button_unchecked'"
                      :color="check.done ? 'green-7' : 'orange-8'"
                      size="20px"
                    />
                  </q-item-section>

                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ check.label }}</q-item-label>
                    <q-item-label caption>{{ check.detail }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="row items-center justify-between">
                  <span class="text-body2 text-grey-8">Ukupno s PDV-om</span>
                  <span class="text-h5 text-weight-bold num">{{ money(grossTotal) }}</span>
                </div>

                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  class="full-width q-mt-md"
                  label="Podnesi zahtjev"
                  :disable="missing.length > 0"
                  :loading="saving"
                  @click="submit"
                />

                <div v-if="missing.length > 0" class="text-caption text-grey-7 text-center q-mt-sm">
                  Preostaje: {{ missing.join(', ') }}.
                </div>

                <q-btn
                  outline
                  no-caps
                  color="grey-8"
                  class="full-width q-mt-sm"
                  label="Spremi i zatvori"
                  :loading="saving"
                  @click="saveDraft"
                />

                <q-btn
                  flat
                  no-caps
                  color="grey-7"
                  class="full-width q-mt-sm"
                  label="Odbaci nacrt"
                  @click="discard"
                />
              </q-card-section>
            </q-card>

            <!-- placeholder: koraci su opisani, tok jos ne salje obavijesti -->
            <q-card flat bordered>
              <q-card-section class="text-subtitle1 text-weight-bold q-pb-none">
                Što slijedi
              </q-card-section>

              <q-list>
                <q-item v-for="(step, index) in nextSteps" :key="step.label">
                  <q-item-section avatar class="check-avatar">
                    <q-avatar size="24px" color="blue-1" text-color="blue-9" class="text-caption">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>

                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ step.label }}</q-item-label>
                    <q-item-label caption>{{ step.detail }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import { gimmiApi } from 'src/services/gimmi-api'
import { useAuthStore } from 'src/stores/auth'

const $q = useQuasar()
const router = useRouter()
const auth = useAuthStore()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })

const dateFormat = new Intl.DateTimeFormat('hr-HR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

// Broj zahtjeva i datum podnosenja dodjeljuje server, pa ih ovdje jos nema.
const fiscalYear = ref(new Date().getFullYear())

const today = dateFormat.format(new Date())

function money(value) {
  return currencyFormat.format(value ?? 0)
}

const offerFile = ref(null)
const offerPicker = ref(null)
const dragOver = ref(false)

const reading = ref(false)
const readError = ref(null)
const readTookMs = ref(0)

// Datoteka se otvara u novoj kartici; objectURL se mora osloboditi.
const offerUrl = ref(null)

const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])

function releaseUrl() {
  if (offerUrl.value !== null) {
    URL.revokeObjectURL(offerUrl.value)
    offerUrl.value = null
  }
}

function pickOffer() {
  offerPicker.value?.pickFiles()
}

function dropOffer(event) {
  dragOver.value = false

  const [file] = event.dataTransfer?.files ?? []

  if (!file) {
    return
  }

  if (!acceptedTypes.has(file.type)) {
    $q.notify({ type: 'warning', message: 'Ponuda mora biti PDF, JPG ili PNG.' })
    return
  }

  offerFile.value = file
}

function removeOffer() {
  offerFile.value = null
  supplier.value = null
  offerNetTotal.value = 0
  readError.value = null
  items.value = items.value.filter((item) => !item.fromOffer)
}

function preview() {
  if (offerUrl.value !== null) {
    window.open(offerUrl.value, '_blank')
  }
}

/**
 * Ponudu cita lokalni model preko servera. Rezultat je prijedlog: stavke
 * zamjenjuju ranije ocitane, a ono sto je podnositelj dodao rucno ostaje.
 */
async function runReading() {
  if (offerFile.value === null || reading.value) {
    return
  }

  reading.value = true
  readError.value = null

  try {
    const result = await gimmiApi.readOffer(offerFile.value)

    supplier.value = result.supplier
    offerNetTotal.value = result.netTotal ?? 0
    readTookMs.value = result.tookMs ?? 0

    items.value = [
      ...result.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        // model ne predlaze kategoriju, nju bira podnositelj
        category: null,
        source: 'iz ponude',
        fromOffer: true,
      })),
      ...items.value.filter((item) => !item.fromOffer),
    ]

    if (result.items.length === 0) {
      readError.value = 'Model nije prepoznao nijednu stavku. Provjeri ponudu ili dodaj ručno.'
    }
  } catch (err) {
    readError.value = err.response?.data?.error ?? `Očitavanje nije uspjelo: ${err.message}`
  } finally {
    reading.value = false
  }
}

watch(offerFile, (file) => {
  releaseUrl()

  if (file === null) {
    return
  }

  offerUrl.value = URL.createObjectURL(file)
  runReading()
})

onBeforeUnmount(releaseUrl)

const offerIcon = computed(() =>
  offerFile.value?.type?.startsWith('image/') ? 'image' : 'picture_as_pdf',
)

const offerHint = computed(() => {
  if (offerFile.value === null) {
    return 'iz nje se popunjavaju stavke'
  }

  return reading.value ? 'očitavam...' : 'izvor stavki ispod'
})

const readLabel = computed(() =>
  readTookMs.value > 0 ? `očitano u ${(readTookMs.value / 1000).toFixed(1)} s` : 'očitano modelom',
)

const offerMeta = computed(() => {
  if (offerFile.value === null) {
    return ''
  }

  const kind = offerFile.value.type === 'application/pdf' ? 'PDF' : 'slika'

  return `${offerFile.value.name} · ${kind}, ${Math.round(offerFile.value.size / 1024)} kB`
})

// Podaci o dobavljacu dolaze iz ocitavanja, pa ih prije njega nema.
const supplier = ref(null)

const categoryOptions = ref([])
const loadingCategories = ref(false)

const items = ref([])

const offerItemCount = computed(() => items.value.filter((item) => item.fromOffer).length)

function addItem() {
  items.value.push({
    name: 'Nova stavka',
    quantity: 1,
    unitPrice: 0,
    category: null,
    source: 'dodano ručno',
    fromOffer: false,
  })
}

const vatRate = 25

// Iznos zahtjeva slijedi stavke; iznos s ponude sluzi samo za provjeru.
const offerNetTotal = ref(0)

const itemsTotal = computed(() =>
  items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
)

const vatAmount = computed(() => (itemsTotal.value * vatRate) / 100)
const grossTotal = computed(() => itemsTotal.value + vatAmount.value)

const matchesOffer = computed(
  () => supplier.value !== null && Math.abs(itemsTotal.value - offerNetTotal.value) < 0.01,
)

const justification = ref('')
const note = ref('')

// placeholder: konto jos nije kolona u ItemCategoryBudget
const accountCodes = {
  'Računalna oprema': '4221',
  'Uredski materijal': '3221',
  'Licence i software': '4123',
}

const costCentre = ref(null)
const costCentreOptions = ref([])
const loadingCostCentres = ref(false)

const uncheckedCategories = computed(
  () => items.value.filter((item) => item.category === null).length,
)

const categoriesDetail = computed(() => {
  if (items.value.length === 0) {
    return 'još nema stavki'
  }

  return uncheckedCategories.value === 0
    ? 'sve stavke imaju kategoriju'
    : `${uncheckedCategories.value} stavka čeka kategoriju`
})

const checklist = computed(() => [
  {
    label: 'Ponuda priložena',
    detail:
      offerFile.value === null
        ? 'bez nje zahtjev se ne može podnijeti'
        : (supplier.value?.name ?? offerFile.value.name),
    done: offerFile.value !== null,
  },
  {
    label: 'Stavke očitane iz ponude',
    detail:
      items.value.length === 0
        ? 'čekaju priloženu ponudu'
        : `${items.value.length} stavki · ${money(itemsTotal.value)} bez PDV-a`,
    done: items.value.length > 0,
  },
  {
    label: 'Zbroj odgovara iznosu na ponudi',
    detail:
      offerNetTotal.value > 0
        ? `na ponudi ${money(offerNetTotal.value)}`
        : 'nema iznosa za usporedbu',
    done: matchesOffer.value,
  },
  {
    label: 'Kategorije provjerene',
    detail: categoriesDetail.value,
    // prazan popis stavki nije provjeren popis
    done: items.value.length > 0 && uncheckedCategories.value === 0,
  },
  {
    label: 'Svrha nabave',
    detail: justification.value.trim() ? 'ispunjeno' : 'obavezno polje',
    done: justification.value.trim().length > 0,
  },
  {
    label: 'Služba ili projekt',
    detail: costCentre.value?.label ?? 'nije odabrano',
    done: costCentre.value !== null,
  },
])

const hasInput = computed(
  () =>
    offerFile.value !== null ||
    items.value.length > 0 ||
    justification.value.trim().length > 0 ||
    note.value.trim().length > 0 ||
    costCentre.value !== null,
)

const missing = computed(() => {
  const fields = []

  if (offerFile.value === null) {
    fields.push('ponuda')
  }

  if (items.value.length === 0) {
    fields.push('stavke')
  }

  if (uncheckedCategories.value > 0) {
    fields.push('kategorija')
  }

  if (!justification.value.trim()) {
    fields.push('svrha nabave')
  }

  if (costCentre.value === null) {
    fields.push('služba')
  }

  return fields
})

// placeholder: tok jos ne salje obavijesti
const nextSteps = [
  { label: 'Voditelj službe', detail: 'odobrava ili vraća na dopunu' },
  { label: 'Računovodstvo', detail: 'provjera konta i sredstava' },
  { label: 'Narudžba dobavljaču', detail: 'dobivaš obavijest e-poštom' },
]

onMounted(async () => {
  loadingCostCentres.value = true
  loadingCategories.value = true

  try {
    const [budgets, categories, years] = await Promise.all([
      gimmiApi.getDepartmentBudgets(),
      gimmiApi.getItemCategoryBudgets(),
      gimmiApi.getFiscalYears(),
    ])

    const openYear = years.find((year) => year.is_closed === 0)

    if (openYear) {
      fiscalYear.value = openYear.year
    }

    costCentreOptions.value = budgets.map((budget) => ({
      ...budget,
      label: `${budget.department_name}${budget.kind === 'PROJECT' ? ' (projekt)' : ''}`,
    }))

    categoryOptions.value = categories.map((category) => ({
      ...category,
      label: accountCodes[category.name]
        ? `${category.name} · konto ${accountCodes[category.name]}`
        : category.name,
    }))
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.response?.data?.error ?? 'Dohvat šifrarnika nije uspio',
    })
  } finally {
    loadingCostCentres.value = false
    loadingCategories.value = false
  }
})

const saving = ref(false)

/**
 * Zahtjev uvijek nastaje kao nacrt; podnosenje je zaseban korak jer server
 * pri njemu provjerava pravila (prilozena ponuda, ovlasti, komentar).
 */
async function create({ andSubmit }) {
  if (saving.value) {
    return
  }

  saving.value = true

  try {
    const request = await gimmiApi.createPurchaseRequest({
      source: 'OFFER',
      departmentBudget: costCentre.value.id_department_budget,
      justification: justification.value.trim() || null,
      items: items.value.map((item) => ({
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        vat_rate: vatRate,
        fk_item_category_budget: item.category?.id_item_category_budget,
      })),
    })

    const id = request.id_purchase_request

    // ponuda je uvjet za podnosenje, pa ide odmah uz nacrt
    if (offerFile.value !== null) {
      await gimmiApi.addAttachment(id, offerFile.value, 'OFFER')
    }

    if (andSubmit) {
      await gimmiApi.changePurchaseRequestStatus(id, 'SUBMITTED', note.value.trim() || null)
    }

    $q.notify({
      type: 'positive',
      message: andSubmit
        ? `Zahtjev ${request.request_number} je podnesen.`
        : `Nacrt ${request.request_number} je spremljen.`,
    })

    await router.push('/zahtjevi')
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.response?.data?.error ?? `Spremanje nije uspjelo: ${err.message}`,
    })
  } finally {
    saving.value = false
  }
}

function saveDraft() {
  if (costCentre.value === null) {
    $q.notify({ type: 'warning', message: 'Odaberite službu ili projekt i prije spremanja.' })
    return
  }

  create({ andSubmit: false })
}

function submit() {
  create({ andSubmit: true })
}

function confirmLeave(title, onOk) {
  $q.dialog({
    title,
    message: 'Uneseni podaci neće biti spremljeni. Nastaviti?',
    cancel: { flat: true, noCaps: true, label: 'Odustani' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Odbaci' },
  }).onOk(onOk)
}

function discard() {
  confirmLeave('Odbaci nacrt', () => router.push('/zahtjevi'))
}

// Prazan obrazac nema sto izgubiti, pa odustajanje tada ide bez pitanja.
function cancel() {
  if (!hasInput.value) {
    router.push('/zahtjevi')
    return
  }

  discard()
}
</script>

<style scoped>
/* Svrha nabave se rasteze do dna stupca, da bude visoka kao sluzba i napomena
   pored nje; na uskom ekranu, gdje se stupci slazu, vrijedi min-height. */
.purpose-field {
  min-height: 120px;
}

.purpose-field :deep(.q-field__control),
.purpose-field :deep(.q-field__native) {
  height: 100%;
}

/* svako polje za unos nosi istaknutu oznaku */
.field-label {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

/* ista visina kao zaglavlje ladice, pa blokovi krecu u ravnini s njezinom crtom */
.page-header {
  height: var(--gimmi-drawer-header);
}

.dropzone {
  border: 1px dashed rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  transition:
    background 0.15s,
    border-color 0.15s;
}

/* povlacenje preko zone mora se vidjeti, inace nije jasno da ce pasti unutra */
.dropzone--over {
  border-color: var(--q-primary);
  background: rgba(25, 118, 210, 0.06);
}

/* zaglavlja kartica u oba stupca imaju istu visinu */
.card-title {
  min-height: 56px;
}

.file-row,
.item-card {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
}

.file-icon {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}

.extra-offer {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}

.add-item {
  border: 1px dashed rgba(0, 0, 0, 0.25);
  border-radius: 10px;
}

.meta-chip {
  font-size: 12px;
}

.check-avatar {
  min-width: 34px;
}

/* brojke se poravnavaju po znamenkama */
.num {
  font-variant-numeric: tabular-nums;
}

/* Akcije ostaju pri ruci i kad je sadrzaj lijevo dug. Odmak je jednak
   padingu stranice, pa desni stupac krece u ravnini s lijevim. */
@media (min-width: 1024px) {
  .side-column {
    position: sticky;
    top: 24px;
  }
}
</style>
