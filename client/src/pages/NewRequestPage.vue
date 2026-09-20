<template>
  <q-page class="bg-grey-2">
    <!-- zaglavlje: odakle, sto je i cije je -->
    <div class="page-header bg-white q-px-lg q-py-md">
      <div class="row items-center justify-between">
        <div>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            icon="arrow_back"
            label="Zahtjevi"
            color="grey-8"
            to="/zahtjevi"
            class="q-mb-xs"
          />

          <div class="row items-center q-gutter-sm">
            <div class="text-h5 text-weight-bold">Novi zahtjev</div>
            <q-chip dense color="grey-3" text-color="grey-9" icon="fiber_manual_record">
              Nacrt
            </q-chip>
          </div>
        </div>

        <div class="text-body2 text-grey-7">
          Podnositelj <span class="text-weight-medium text-grey-9">{{ auth.fullName }}</span>
          <span class="q-mx-sm text-grey-5">|</span>{{ today }}
        </div>
      </div>
    </div>

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
        <!-- lijevo: sadrzaj zahtjeva -->
        <div class="col-12 col-md-8">
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="row items-center q-gutter-sm">
                <div class="text-subtitle1 text-weight-bold">Svrha nabave</div>
                <q-badge color="red-1" text-color="red-9" label="OBAVEZNO" />
              </div>
              <div class="text-body2 text-grey-7">Ovaj tekst čita osoba koja odobrava zahtjev.</div>

              <q-input
                v-model="justification"
                outlined
                type="textarea"
                rows="4"
                class="q-mt-md"
                placeholder="Zašto je nabava potrebna i do kada?"
                hint="2–3 rečenice: za koga je oprema, što se njome rješava i postoji li rok."
              />
            </q-card-section>
          </q-card>

          <q-card flat bordered class="q-mb-md">
            <q-card-section class="row items-center justify-between">
              <div class="row items-center q-gutter-sm">
                <div class="text-subtitle1 text-weight-bold">Ponuda</div>
                <q-chip dense color="grey-3" text-color="grey-9">
                  {{ supplier.offerNumber }} · {{ supplier.name }}
                </q-chip>
              </div>

              <q-btn
                flat
                dense
                no-caps
                color="primary"
                icon="cached"
                label="Zamijeni"
                @click="replaceOffer"
              />
            </q-card-section>

            <q-card-section class="q-pt-none">
              <div class="file-row row items-center no-wrap q-gutter-md q-pa-sm">
                <q-avatar square size="44px" class="file-thumb">
                  <img v-if="offerPreview" :alt="offerName" :src="offerPreview" />
                  <q-icon v-else name="picture_as_pdf" size="24px" color="red-6" />
                </q-avatar>

                <div class="col ellipsis">
                  <div class="text-body1 ellipsis">{{ offerName }}</div>
                  <div class="text-caption text-grey-7">{{ offerMeta }}</div>
                </div>

                <q-btn outline dense no-caps icon="visibility" label="Pregledaj" @click="preview" />
              </div>

              <div class="q-mt-md">
                <div class="row justify-between q-py-sm">
                  <span class="text-grey-8">OIB dobavljača</span>
                  <span>{{ supplier.oib }}</span>
                </div>

                <div class="row justify-between items-center q-py-sm">
                  <span class="text-grey-8">Ponuda vrijedi do</span>
                  <span class="row items-center q-gutter-sm">
                    <span>{{ supplier.validUntil }}</span>
                    <q-chip v-if="validityLabel" dense color="grey-3" text-color="grey-9">
                      {{ validityLabel }}
                    </q-chip>
                  </span>
                </div>

                <div class="row justify-between q-py-sm">
                  <span class="text-grey-8">Osnovica</span>
                  <span>{{ money(netTotal) }}</span>
                </div>

                <div class="row justify-between q-py-sm">
                  <span class="text-grey-8">PDV {{ vatRate }} %</span>
                  <span>{{ money(vatAmount) }}</span>
                </div>

                <q-separator class="q-my-sm" />

                <div class="row justify-between text-weight-bold text-body1">
                  <span>Ukupno s PDV-om</span>
                  <span>{{ money(grossTotal) }}</span>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered>
            <q-card-section class="row items-start justify-between">
              <div>
                <div class="row items-center q-gutter-sm">
                  <div class="text-subtitle1 text-weight-bold">Stavke</div>
                  <q-chip dense color="grey-3" text-color="grey-9">
                    {{ items.length }} očitane iz ponude
                  </q-chip>
                </div>
                <div class="text-body2 text-grey-7">
                  Provjerite količine i dopunite kategoriju — ona određuje konto na koji trošak ide.
                </div>
              </div>

              <q-btn
                flat
                dense
                no-caps
                color="primary"
                icon="add"
                label="Dodaj stavku"
                @click="addItem"
              />
            </q-card-section>

            <q-markup-table flat square separator="horizontal">
              <thead>
                <tr class="text-grey-7">
                  <th class="text-left">Naziv</th>
                  <th class="text-right">Kol.</th>
                  <th class="text-right">Jed. cijena</th>
                  <th class="text-right">Ukupno</th>
                  <th class="text-left">Kategorija</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="(item, index) in items" :key="index">
                  <td class="text-weight-medium">{{ item.name }}</td>
                  <td class="text-right">{{ item.quantity }}</td>
                  <td class="text-right">{{ money(item.unitPrice) }}</td>
                  <td class="text-right">{{ money(item.quantity * item.unitPrice) }}</td>
                  <td>
                    <!-- kategorija je prepoznata, ali se smije ispraviti -->
                    <q-select
                      v-model="item.category"
                      outlined
                      dense
                      options-dense
                      :options="categoryOptions"
                      option-label="name"
                      :loading="loadingCategories"
                      class="category-select"
                    />
                  </td>
                </tr>

                <tr v-if="items.length === 0">
                  <td colspan="5" class="text-center text-grey-7 q-py-lg">
                    Iz ponude nije očitana nijedna stavka.
                  </td>
                </tr>
              </tbody>
            </q-markup-table>

            <q-card-section class="row items-center justify-end q-gutter-md">
              <span class="text-grey-8">Zbroj stavki (bez PDV-a)</span>
              <span class="text-weight-medium">{{ money(itemsTotal) }}</span>

              <!-- ako se ne poklapa, negdje je ocitanje promasilo -->
              <span v-if="matchesOffer" class="text-positive row items-center q-gutter-xs">
                <q-icon name="check" size="18px" />
                <span>slaže se s ponudom</span>
              </span>
              <span v-else class="text-negative row items-center q-gutter-xs">
                <q-icon name="error_outline" size="18px" />
                <span>ne slaže se s ponudom</span>
              </span>
            </q-card-section>
          </q-card>
        </div>

        <!-- desno: ono sto podnositelj odlucuje i cime zavrsava -->
        <div class="col-12 col-md-4">
          <div class="side-column">
            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="row items-center q-gutter-sm">
                  <div class="text-subtitle1 text-weight-bold">Troškovno mjesto</div>
                  <q-badge color="red-1" text-color="red-9" label="OBAVEZNO" />
                </div>

                <q-select
                  v-model="costCentre"
                  outlined
                  class="q-mt-md"
                  label="Odaberite službu ili projekt"
                  :options="costCentreOptions"
                  option-label="label"
                  option-value="id_department_budget"
                  :loading="loadingCostCentres"
                />

                <div class="text-body2 text-grey-7 q-mt-sm">
                  Trošak se knjiži na odabranu službu; odobrava ga njezin voditelj.
                </div>

                <div class="amount-box q-pa-md q-mt-md">
                  <div class="text-body2 text-grey-8">Iznos zahtjeva</div>
                  <div class="text-h5 text-weight-bold">{{ money(grossTotal) }}</div>
                  <div class="text-body2 text-grey-7">
                    Osnovica {{ money(netTotal) }} + PDV {{ money(vatAmount) }}
                  </div>
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="row items-center justify-between">
                  <div class="text-subtitle1 text-weight-bold">Dodatni prilozi</div>
                  <div class="text-caption text-grey-6">NIJE OBAVEZNO</div>
                </div>
                <div class="text-body2 text-grey-7">
                  Druga ponuda, specifikacija ili e-pošta s dogovorom.
                </div>

                <q-file
                  v-model="extraFiles"
                  multiple
                  borderless
                  class="q-mt-md"
                  accept=".pdf,.docx,.xlsx,image/*"
                  max-file-size="10485760"
                >
                  <template #default>
                    <div class="dropzone column flex-center q-pa-lg full-width">
                      <q-icon name="file_upload" size="28px" color="grey-6" />
                      <div class="q-mt-sm text-body2">
                        Povucite datoteke ili <span class="text-primary">odaberite</span>
                      </div>
                      <div class="text-caption text-grey-7">
                        PDF, DOCX, XLSX ili slika — do 10 MB
                      </div>

                      <div v-if="extraFiles?.length" class="text-caption text-grey-8 q-mt-sm">
                        Dodano: {{ extraFiles.length }}
                      </div>
                    </div>
                  </template>
                </q-file>
              </q-card-section>
            </q-card>

            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle1 text-weight-bold q-mb-md">Podnošenje</div>

                <q-banner v-if="missing.length > 0" dense class="bg-amber-1 text-grey-9 q-mb-md">
                  <template #avatar>
                    <q-icon name="error_outline" color="amber-9" />
                  </template>
                  Prije podnošenja ispunite:
                  <span class="text-weight-bold">{{ missing.join(' i ') }}</span
                  >.
                </q-banner>

                <div class="text-body2 q-mb-xs">
                  Napomena operateru <span class="text-grey-7">(nije obavezno)</span>
                </div>
                <q-input
                  v-model="note"
                  outlined
                  dense
                  placeholder="npr. hitno, zamjena za pokvareno računalo"
                />

                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  class="full-width q-mt-md"
                  label="Podnesi zahtjev"
                  icon-right="arrow_forward"
                  :disable="missing.length > 0"
                  :loading="saving"
                  @click="submit"
                />

                <q-btn
                  outline
                  no-caps
                  color="grey-8"
                  class="full-width q-mt-sm"
                  label="Spremi kao nacrt"
                  :loading="saving"
                  @click="saveDraft"
                />

                <div class="text-caption text-grey-7 text-center q-mt-md">
                  Podneseni zahtjev ide operateru nabave.<br />
                  Nacrt ostaje vidljiv samo vama.
                </div>
              </q-card-section>
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
const auth = useAuthStore()
const router = useRouter()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })

function money(value) {
  return currencyFormat.format(value ?? 0)
}

const today = new Date().toLocaleDateString('hr-HR')

const offerFile = ref(null)
const extraFiles = ref(null)
const reading = ref(false)

// Slika ponude se prikazuje kao sličica; objectURL se mora osloboditi.
const offerPreview = ref(null)
const offerUrl = ref(null)

let readingTimer = null

function releaseUrls() {
  for (const url of [offerPreview.value, offerUrl.value]) {
    if (url !== null) {
      URL.revokeObjectURL(url)
    }
  }

  offerPreview.value = null
  offerUrl.value = null
}

watch(offerFile, (file) => {
  releaseUrls()

  if (file === null) {
    return
  }

  offerUrl.value = URL.createObjectURL(file)

  if (file.type?.startsWith('image/')) {
    offerPreview.value = offerUrl.value
  }

  // ovdje ce ici pravo ocitavanje ponude
  reading.value = true
  readingTimer = setTimeout(() => {
    reading.value = false
  }, 2000)
})

onBeforeUnmount(() => {
  clearTimeout(readingTimer)
  releaseUrls()
})

function replaceOffer() {
  offerFile.value = null
}

function preview() {
  if (offerUrl.value !== null) {
    window.open(offerUrl.value, '_blank')
  }
}

const offerName = computed(() => offerFile.value?.name ?? 'ponuda.pdf')

const offerMeta = computed(() =>
  offerFile.value === null ? '' : `${Math.round(offerFile.value.size / 1024)} kB · učitano danas`,
)

// Placeholder podaci - zasad se ne salju nikamo.
const supplier = ref({
  name: 'Links d.o.o.',
  oib: '12345678901',
  offerNumber: 'P-4471/2026',
  validUntil: '30. 09. 2026.',
  validUntilDate: '2026-09-30',
})

const validityLabel = computed(() => {
  const days = Math.ceil((new Date(supplier.value.validUntilDate) - new Date()) / 86400000)

  if (days < 0) {
    return 'isteklo'
  }

  return days === 0 ? 'ističe danas' : `još ${days} dana`
})

const items = ref([
  {
    name: 'Prijenosno računalo 14", 16 GB / 512 GB',
    quantity: 1,
    unitPrice: 999.2,
    category: null,
  },
  { name: 'Docking stanica USB-C', quantity: 1, unitPrice: 160, category: null },
])

const vatRate = 25

// iznos s ponude; zbroj stavki mora mu odgovarati
const netTotal = ref(1159.2)
const vatAmount = computed(() => (netTotal.value * vatRate) / 100)
const grossTotal = computed(() => netTotal.value + vatAmount.value)

const itemsTotal = computed(() =>
  items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
)

const matchesOffer = computed(() => Math.abs(itemsTotal.value - netTotal.value) < 0.01)

const justification = ref('')
const note = ref('')

// Kategorije koje nudi proracun; ocitavanje ponude predlaze jednu po stavci.
const categoryOptions = ref([])
const loadingCategories = ref(false)

function addItem() {
  items.value.push({
    name: 'Nova stavka',
    quantity: 1,
    unitPrice: 0,
    category: categoryOptions.value[0] ?? null,
  })
}

// Troskovno mjesto bira podnositelj: isti covjek moze trositi na vise sluzbi
// i projekata, pa se ne moze izvesti iz njega samog.
const costCentre = ref(null)
const costCentreOptions = ref([])
const loadingCostCentres = ref(false)

const missing = computed(() => {
  const fields = []

  if (!justification.value.trim()) {
    fields.push('svrhu nabave')
  }

  if (costCentre.value === null) {
    fields.push('troškovno mjesto')
  }

  return fields
})

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

    categoryOptions.value = categories

    // ocitavanje ponude zasad predlaze prvu kategoriju
    for (const item of items.value) {
      item.category ??= categories[0] ?? null
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

    for (const file of extraFiles.value ?? []) {
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
    $q.notify({ type: 'warning', message: 'Odaberite troškovno mjesto i prije spremanja nacrta.' })
    return
  }

  create({ andSubmit: false })
}

function submit() {
  create({ andSubmit: true })
}
</script>

<style scoped>
.page-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.dropzone {
  border: 1px dashed rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}

.file-row {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.file-thumb {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.amount-box {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.category-select {
  min-width: 170px;
}

/* akcije ostaju pri ruci i kad je sadrzaj lijevo dug */
@media (min-width: 1024px) {
  .side-column {
    position: sticky;
    top: 74px;
  }
}
</style>
