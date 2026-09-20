<template>
  <q-page class="bg-grey-2">
    <div class="q-pa-lg">
      <!-- bez ponude nema sto ocitati, pa je prijenos jedino sto se nudi -->
      <q-card v-if="offerFile === null" flat bordered>
        <q-card-section class="dropzone column flex-center q-pa-xl q-ma-md">
          <q-icon name="cloud_upload" size="44px" color="grey-6" />

          <div class="text-subtitle1 q-mt-md">Priložite ponudu dobavljača</div>
          <div class="text-body2 text-grey-7 text-center">
            Prijenos povlačenjem ili slikanjem mobitelom; dopušteni PDF, JPG, PNG
          </div>

          <q-file
            v-model="offerFile"
            outlined
            dense
            class="q-mt-lg"
            style="max-width: 320px; width: 100%"
            label="Odaberite datoteku"
            accept=".pdf,image/jpeg,image/png"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
        </q-card-section>
      </q-card>

      <!-- ovdje ce ici poziv na ocitavanje ponude -->
      <q-card v-else-if="reading" flat bordered>
        <q-card-section class="column flex-center q-pa-xl q-gutter-md">
          <q-spinner color="primary" size="42px" />
          <div class="text-body2 text-grey-7">Očitavam ponudu...</div>
        </q-card-section>
      </q-card>

      <div v-else class="row q-col-gutter-md">
        <div class="col-12 col-md-8">
          <!-- 1. ponuda -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="row items-center q-gutter-sm card-title q-pb-sm">
              <q-avatar size="26px" color="green-8" text-color="white" class="step-badge">
                1
              </q-avatar>
              <div class="text-subtitle1 text-weight-bold">Ponuda</div>
              <div class="text-body2 text-grey-7">izvor svih podataka ispod</div>
            </q-card-section>

            <q-card-section class="q-pt-none">
              <div class="file-row row items-center q-col-gutter-md q-pa-md">
                <div class="col row items-center no-wrap q-gutter-md">
                  <q-avatar square size="40px" class="file-icon">
                    <q-icon :name="offerIcon" size="22px" color="grey-7" />
                  </q-avatar>

                  <div class="col ellipsis">
                    <div class="row items-baseline q-gutter-sm">
                      <span class="text-weight-bold">{{ supplier.name }}</span>
                      <span class="text-body2 text-grey-8">ponuda {{ supplier.offerNumber }}</span>
                    </div>

                    <div class="text-caption text-grey-7 ellipsis">
                      OIB {{ supplier.oib }} · {{ offerMeta }}
                    </div>

                    <div class="row items-center q-gutter-xs q-mt-xs">
                      <q-chip
                        dense
                        square
                        :color="validityExpired ? 'red-1' : 'orange-1'"
                        :text-color="validityExpired ? 'red-9' : 'orange-9'"
                        icon="schedule"
                        class="meta-chip"
                        :label="validityExpired ? 'Ponuda je istekla' : `Vrijedi ${validityLabel}`"
                      />

                      <!-- placeholder: provjera je li ponuda vec koristena -->
                      <q-chip
                        dense
                        square
                        color="green-1"
                        text-color="green-9"
                        icon="check"
                        class="meta-chip"
                        label="nije ranije korištena"
                      />
                    </div>
                  </div>
                </div>

                <!-- pregled je cesta radnja, zamjena rijetka i brise ocitano -->
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
                    flat
                    dense
                    no-caps
                    color="grey-7"
                    icon="cached"
                    label="Zamijeni"
                    @click="replaceOffer"
                  />
                </div>
              </div>

              <!-- usporedne ponude drugih dobavljaca -->
              <q-file
                ref="extraOfferPicker"
                v-model="pickedExtraOffer"
                multiple
                class="hidden"
                accept=".pdf,image/jpeg,image/png"
              />

              <div
                v-for="(file, index) in extraOffers"
                :key="index"
                class="extra-offer row items-center no-wrap q-gutter-md q-px-md q-py-sm q-mt-sm"
              >
                <q-icon name="description" size="20px" color="grey-7" />
                <div class="col ellipsis">
                  <span class="text-body2">{{ file.name }}</span>
                  <span class="text-caption text-grey-7"> · usporedna ponuda</span>
                </div>
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="close"
                  color="grey-7"
                  @click="extraOffers.splice(index, 1)"
                />
              </div>

              <q-btn
                flat
                dense
                no-caps
                color="primary"
                icon="add"
                label="Dodaj usporednu ponudu"
                class="q-mt-sm"
                @click="pickExtraOffer"
              />
            </q-card-section>
          </q-card>

          <!-- 2. stavke -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="row items-center justify-between q-pb-none">
              <div class="row items-center q-gutter-sm">
                <q-avatar size="26px" color="green-8" text-color="white" class="step-badge">
                  2
                </q-avatar>
                <div class="text-subtitle1 text-weight-bold">Stavke</div>
                <q-chip dense square color="blue-1" text-color="blue-9" icon="auto_awesome">
                  {{ items.length }} očitane iz ponude
                </q-chip>
              </div>

              <!-- placeholder: ponovno ocitavanje iste datoteke -->
              <q-btn
                outline
                no-caps
                color="grey-8"
                icon="refresh"
                label="Očitaj ponovno"
                @click="rereadOffer"
              />
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
                      style="min-width: 260px"
                      @update:model-value="item.categoryConfirmed = true"
                    />
                  </div>
                </div>

                <!-- placeholder: ocitavanje jos ne vraca pouzdanost prijedloga -->
                <q-banner
                  v-if="item.lowConfidence && !item.categoryConfirmed"
                  dense
                  class="bg-orange-1 text-grey-9 q-mt-md"
                >
                  <template #avatar>
                    <q-icon name="warning" color="orange-9" />
                  </template>

                  Kategoriju je predložio model s niskom sigurnošću. Provjeri konto ili odaberi
                  drugu kategoriju.

                  <template #action>
                    <q-btn
                      outline
                      dense
                      no-caps
                      color="grey-8"
                      label="Točno je"
                      @click="item.categoryConfirmed = true"
                    />
                  </template>
                </q-banner>
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
                    v-if="matchesOffer"
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

          <!-- 3. obrazlozenje -->
          <q-card flat bordered>
            <q-card-section class="row items-center q-gutter-sm q-pb-sm">
              <q-avatar size="26px" color="grey-5" text-color="white" class="step-badge">
                3
              </q-avatar>
              <div class="text-subtitle1 text-weight-bold">Obrazloženje i trošak</div>
              <div class="text-body2 text-grey-7">ovo čita osoba koja odobrava</div>
            </q-card-section>

            <q-card-section class="q-pt-none">
              <div class="text-body2 q-mb-xs">Svrha nabave</div>
              <q-input
                v-model="justification"
                outlined
                type="textarea"
                rows="4"
                maxlength="1000"
                placeholder="Za koga je, zašto je potrebno i do kada treba stići."
              />
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ justification.length }} / 1000 znakova
              </div>

              <div class="row q-col-gutter-md q-mt-sm">
                <div class="col-12 col-sm-6">
                  <div class="text-body2 q-mb-xs">Služba ili projekt</div>
                  <q-select
                    v-model="costCentre"
                    outlined
                    dense
                    label="Odaberite"
                    :options="costCentreOptions"
                    option-label="label"
                    option-value="id_department_budget"
                    :loading="loadingCostCentres"
                  />
                </div>

                <div class="col-12 col-sm-6">
                  <div class="text-body2 q-mb-xs">
                    Napomena operateru <span class="text-grey-7">(nije obavezno)</span>
                  </div>
                  <q-input
                    v-model="note"
                    outlined
                    dense
                    placeholder="npr. hitno, zamjena za pokvareno računalo"
                  />
                </div>
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

const $q = useQuasar()
const router = useRouter()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })

function money(value) {
  return currencyFormat.format(value ?? 0)
}

const offerFile = ref(null)
const reading = ref(false)

// Datoteka se otvara u novoj kartici; objectURL se mora osloboditi.
const offerUrl = ref(null)

let readingTimer = null

function releaseUrl() {
  if (offerUrl.value !== null) {
    URL.revokeObjectURL(offerUrl.value)
    offerUrl.value = null
  }
}

function startReading() {
  // ovdje ce ici pravo ocitavanje ponude
  reading.value = true
  readingTimer = setTimeout(() => {
    reading.value = false
  }, 2000)
}

watch(offerFile, (file) => {
  releaseUrl()

  if (file === null) {
    return
  }

  offerUrl.value = URL.createObjectURL(file)
  startReading()
})

onBeforeUnmount(() => {
  clearTimeout(readingTimer)
  releaseUrl()
})

function replaceOffer() {
  offerFile.value = null
}

function rereadOffer() {
  startReading()
}

function preview() {
  if (offerUrl.value !== null) {
    window.open(offerUrl.value, '_blank')
  }
}

const offerIcon = computed(() =>
  offerFile.value?.type?.startsWith('image/') ? 'image' : 'picture_as_pdf',
)

const offerMeta = computed(() => {
  if (offerFile.value === null) {
    return ''
  }

  const kind = offerFile.value.type === 'application/pdf' ? 'PDF' : 'slika'
  const time = new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })

  return `${kind}, ${Math.round(offerFile.value.size / 1024)} kB · učitano danas u ${time}`
})

// usporedne ponude drugih dobavljaca za istu nabavu
const extraOffers = ref([])
const extraOfferPicker = ref(null)
const pickedExtraOffer = ref(null)

function pickExtraOffer() {
  extraOfferPicker.value?.pickFiles()
}

watch(pickedExtraOffer, (files) => {
  if (!files?.length) {
    return
  }

  extraOffers.value.push(...files)
  pickedExtraOffer.value = null
})

// Placeholder podaci - ocitavanje ponude jos ne postoji.
const supplier = ref({
  name: 'Links d.o.o.',
  oib: '12345678901',
  offerNumber: 'P-4471/2026',
  validUntilDate: '2026-09-30',
})

const validityExpired = computed(() => new Date(supplier.value.validUntilDate) < new Date())

const validityLabel = computed(() => {
  const days = Math.ceil((new Date(supplier.value.validUntilDate) - new Date()) / 86400000)

  if (days <= 0) {
    return 'isteklo'
  }

  return days === 1 ? 'još 1 dan' : `još ${days} dana`
})

const categoryOptions = ref([])
const loadingCategories = ref(false)

const items = ref([
  {
    name: 'Prijenosno računalo 14", 16 GB / 512 GB',
    quantity: 1,
    unitPrice: 999.2,
    category: null,
    source: 'ponuda, red 1',
    lowConfidence: false,
    categoryConfirmed: true,
  },
  {
    name: 'Docking stanica USB-C',
    quantity: 1,
    unitPrice: 160,
    category: null,
    source: 'ponuda, red 2',
    // placeholder: ocitavanje jos ne vraca pouzdanost prijedloga
    lowConfidence: true,
    categoryConfirmed: false,
  },
])

function addItem() {
  items.value.push({
    name: 'Nova stavka',
    quantity: 1,
    unitPrice: 0,
    category: categoryOptions.value[0] ?? null,
    source: 'dodano ručno',
    lowConfidence: false,
    categoryConfirmed: true,
  })
}

const vatRate = 25

// Iznos zahtjeva slijedi stavke; iznos s ponude sluzi samo za provjeru.
const offerNetTotal = ref(1159.2)

const itemsTotal = computed(() =>
  items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
)

const vatAmount = computed(() => (itemsTotal.value * vatRate) / 100)
const grossTotal = computed(() => itemsTotal.value + vatAmount.value)

const matchesOffer = computed(() => Math.abs(itemsTotal.value - offerNetTotal.value) < 0.01)

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
  () => items.value.filter((item) => item.category === null || !item.categoryConfirmed).length,
)

const checklist = computed(() => [
  {
    label: 'Ponuda priložena',
    detail: `${supplier.value.offerNumber} · vrijedi ${validityLabel.value}`,
    done: offerFile.value !== null,
  },
  {
    label: 'Zbroj stavki odgovara ponudi',
    detail: `${money(itemsTotal.value)} bez PDV-a`,
    done: matchesOffer.value,
  },
  {
    label: 'Kategorije provjerene',
    detail:
      uncheckedCategories.value === 0
        ? 'sve stavke imaju potvrđenu kategoriju'
        : `${uncheckedCategories.value} stavka čeka potvrdu`,
    done: uncheckedCategories.value === 0,
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

const missing = computed(() => {
  const fields = []

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
    const [budgets, categories] = await Promise.all([
      gimmiApi.getDepartmentBudgets(),
      gimmiApi.getItemCategoryBudgets(),
    ])

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

    // ocitavanje ponude zasad predlaze prvu kategoriju
    for (const item of items.value) {
      item.category ??= categoryOptions.value[0] ?? null
    }
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
    await gimmiApi.addAttachment(id, offerFile.value, 'OFFER')

    for (const file of extraOffers.value) {
      await gimmiApi.addAttachment(id, file, 'OTHER')
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

function discard() {
  $q.dialog({
    title: 'Odbaci nacrt',
    message: 'Uneseni podaci neće biti spremljeni. Nastaviti?',
    cancel: { flat: true, noCaps: true, label: 'Odustani' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Odbaci' },
  }).onOk(() => router.push('/zahtjevi'))
}
</script>

<style scoped>
.dropzone {
  border: 1px dashed rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}

/* zaglavlja kartica u oba stupca imaju istu visinu */
.card-title {
  min-height: 56px;
}

.step-badge {
  font-size: 13px;
  font-weight: 600;
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

/* akcije ostaju pri ruci i kad je sadrzaj lijevo dug */
@media (min-width: 1024px) {
  .side-column {
    position: sticky;
    top: 74px;
  }
}
</style>
