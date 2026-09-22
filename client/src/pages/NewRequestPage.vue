<template>
  <q-page class="bg-grey-2 with-page-header">
    <!-- Zaglavlje stoji u traci logotipa; desno se vidi sto jos nedostaje. -->
    <div class="page-header row items-center no-wrap q-px-lg">
      <q-btn flat dense no-caps color="grey-7" icon="arrow_back" label="Odustani" @click="cancel" />

      <div class="text-h6 q-ml-md col">Novi zahtjev</div>

      <div class="row items-center no-wrap q-gutter-lg">
        <div v-for="check in checklist" :key="check.label" class="row items-center no-wrap">
          <q-icon
            :name="check.done ? 'check_circle' : 'radio_button_unchecked'"
            :color="check.done ? 'green-7' : 'orange-8'"
            size="18px"
            class="q-mr-xs"
          />

          <span class="text-body2" :class="check.done ? 'text-grey-8' : 'text-grey-7'">
            {{ check.label }}
          </span>

          <q-tooltip v-if="check.detail">{{ check.detail }}</q-tooltip>
        </div>
      </div>
    </div>

    <div class="request-layout q-px-lg q-pb-lg">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-md">
          <!-- Tko trazi, kada, na ciji trosak i zasto. -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="q-pb-none">
              <div class="row items-center no-wrap q-gutter-sm">
                <div class="text-subtitle1 text-weight-bold">Zahtjev</div>

                <q-chip dense square color="grey-3" text-color="grey-8" class="meta-chip">
                  nacrt
                </q-chip>

                <q-space />

                <div class="text-body2 text-grey-7 ellipsis">
                  {{ auth.fullName }} · {{ today }} · broj se dodjeljuje pri spremanju
                </div>
              </div>
            </q-card-section>

            <q-card-section class="row q-col-gutter-md">
              <div class="col-12 col-md-6 column">
                <div class="row items-baseline q-mb-xs">
                  <div class="field-label col row items-center no-wrap">
                    <q-icon
                      :name="justificationDone ? 'check_circle' : 'radio_button_unchecked'"
                      :color="justificationDone ? 'green-7' : 'orange-8'"
                      size="18px"
                      class="q-mr-sm"
                    />

                    <span>Svrha nabave</span>
                  </div>

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
                <div class="field-label row items-center no-wrap q-mb-xs">
                  <q-icon
                    :name="costCentre === null ? 'radio_button_unchecked' : 'check_circle'"
                    :color="costCentre === null ? 'orange-8' : 'green-7'"
                    size="18px"
                    class="q-mr-sm"
                  />

                  <span>Služba ili projekt</span>
                </div>

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

          <!-- Ponuda je izvor stavki: model je procita, podnositelj ispravi. -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section :class="offers.length > 0 ? 'q-pa-sm' : ''">
              <div
                class="dropzone column flex-center cursor-pointer"
                :class="{ 'dropzone--over': dragOver, 'dropzone--small': offers.length > 0 }"
                @click="pickOffer"
                @dragenter.prevent="dragOver = true"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="dropOffer"
              >
                <template v-if="offers.length === 0">
                  <q-icon name="picture_as_pdf" size="44px" color="grey-6" />

                  <div class="text-subtitle1 q-mt-md">Povucite ponudu ovdje ili kliknite</div>

                  <div class="text-body2 text-grey-7 text-center q-mt-xs">
                    Model prepiše dobavljača, stavke, količine i iznose sa i bez PDV-a.
                  </div>

                  <div class="text-caption text-grey-6 q-mt-sm">
                    Za očitavanje se prima samo PDF; možete dodati i više ponuda.
                  </div>
                </template>

                <div v-else class="row items-center no-wrap text-body2 text-grey-7 q-gutter-sm">
                  <q-icon name="add" size="20px" />
                  <span>Dodajte još jednu ponudu</span>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- svaka ponuda nosi svog dobavljaca i svoju tablicu stavki -->
          <q-card v-for="offer in offers" :key="offer.id" flat bordered class="q-mb-md">
            <q-card-section class="q-pb-none">
              <div class="row items-center no-wrap q-gutter-sm">
                <div class="text-subtitle1 text-weight-bold">Dobavljač</div>

                <q-chip
                  v-if="offer.recognised"
                  dense
                  outline
                  color="grey-7"
                  class="recognised-chip"
                  label="prepoznato iz ponude"
                />

                <q-space />

                <div class="text-caption text-grey-6 ellipsis">{{ offer.file.name }}</div>

                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="close"
                  color="grey-7"
                  @click="removeOffer(offer)"
                >
                  <q-tooltip>Ukloni ponudu</q-tooltip>
                </q-btn>
              </div>
            </q-card-section>

            <q-card-section class="row q-col-gutter-md">
              <q-input
                v-model="offer.supplier.name"
                outlined
                dense
                label="Naziv"
                class="col-12 col-md-6"
              />

              <q-input
                v-model="offer.supplier.oib"
                outlined
                dense
                label="OIB"
                class="col-12 col-md-6"
              />

              <q-input
                v-model="offer.supplier.offerNumber"
                outlined
                dense
                label="Broj ponude"
                class="col-12 col-md-6"
              />

              <q-input
                v-model="offer.supplier.validUntil"
                outlined
                dense
                label="Ponuda vrijedi do"
                class="col-12 col-md-6"
              />
            </q-card-section>

            <q-separator />

            <q-card-section class="row items-center no-wrap q-py-sm">
              <div class="text-subtitle1 text-weight-bold col">Stavke</div>

              <q-btn
                outline
                dense
                no-caps
                color="grey-8"
                icon="add"
                label="Dodaj stavku"
                @click="addItem(offer)"
              />
            </q-card-section>

            <q-separator />

            <q-card-section v-if="offer.reading" class="row items-center q-gutter-md">
              <q-spinner color="primary" size="22px" />
              <span class="text-body2 text-grey-7">Model čita ponudu...</span>
            </q-card-section>

            <q-banner v-else-if="offer.error" dense class="bg-red-1 text-grey-9">
              <template #avatar>
                <q-icon name="error_outline" color="red-9" />
              </template>

              {{ offer.error }}
            </q-banner>

            <q-card-section v-else-if="offer.items.length === 0" class="text-body2 text-grey-7">
              Nijedna stavka nije očitana. Dodajte ih ručno gumbom iznad.
            </q-card-section>

            <q-card-section v-else class="q-pa-none">
              <q-markup-table flat square dense class="items-table">
                <thead>
                  <tr>
                    <th class="text-left">Naziv</th>
                    <th class="text-right" style="width: 110px">Količina</th>
                    <th class="text-right" style="width: 140px">Jed. cijena</th>
                    <th class="text-right" style="width: 140px">Ukupno</th>
                    <th style="width: 76px"></th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="(item, index) in offer.items" :key="index">
                    <template v-if="editing === itemKey(offer, index)">
                      <td>
                        <q-input v-model="item.name" dense outlined autofocus />
                      </td>

                      <td>
                        <q-input
                          v-model.number="item.quantity"
                          dense
                          outlined
                          type="number"
                          min="1"
                          input-class="text-right"
                        />
                      </td>

                      <td>
                        <q-input
                          v-model.number="item.unitPrice"
                          dense
                          outlined
                          type="number"
                          min="0"
                          step="0.01"
                          input-class="text-right"
                        />
                      </td>

                      <td class="text-right num">{{ money(lineTotal(item)) }}</td>

                      <td class="text-right">
                        <q-btn
                          flat
                          dense
                          round
                          size="sm"
                          icon="done"
                          color="primary"
                          @click="editing = null"
                        >
                          <q-tooltip>Gotovo</q-tooltip>
                        </q-btn>

                        <q-btn
                          flat
                          dense
                          round
                          size="sm"
                          icon="delete_outline"
                          color="grey-6"
                          @click="removeItem(offer, index)"
                        >
                          <q-tooltip>Ukloni stavku</q-tooltip>
                        </q-btn>
                      </td>
                    </template>

                    <template v-else>
                      <td class="text-weight-medium">{{ item.name || '—' }}</td>
                      <td class="text-right num">{{ item.quantity }} kom</td>
                      <td class="text-right num">{{ money(item.unitPrice) }}</td>
                      <td class="text-right num">{{ money(lineTotal(item)) }}</td>

                      <td class="text-right">
                        <q-btn
                          flat
                          dense
                          round
                          size="sm"
                          icon="edit"
                          color="grey-6"
                          @click="editing = itemKey(offer, index)"
                        >
                          <q-tooltip>Uredi stavku</q-tooltip>
                        </q-btn>
                      </td>
                    </template>
                  </tr>

                  <!-- zbroj se izvodi iz stavki, pa prati svaku ispravku -->
                  <tr class="sum-row">
                    <td colspan="3" class="text-right text-grey-7">Osnovica</td>
                    <td class="text-right num text-weight-bold">{{ money(derivedNet(offer)) }}</td>
                    <td></td>
                  </tr>

                  <tr class="sum-row">
                    <td colspan="3" class="text-right text-grey-7">PDV {{ vatRate }} %</td>
                    <td class="text-right num">{{ money(derivedVat(offer)) }}</td>
                    <td></td>
                  </tr>

                  <tr class="sum-row">
                    <td colspan="3" class="text-right text-weight-bold">Ukupno s PDV-om</td>
                    <td class="text-right num text-weight-bold">
                      {{ money(derivedTotal(offer)) }}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </q-markup-table>
            </q-card-section>

            <!-- model zna prepisati iznos krivo; zbroj stavki to otkrije -->
            <q-card-section v-if="offerDiffers(offer)" class="q-pt-none">
              <q-banner dense class="bg-orange-1 text-grey-9">
                <template #avatar>
                  <q-icon name="error_outline" color="orange-9" />
                </template>

                Na ponudi piše {{ money(offer.total) }}, a zbroj stavki daje
                {{ money(derivedTotal(offer)) }}. Provjerite stavke.
              </q-banner>
            </q-card-section>
          </q-card>

          <!-- Zbroj svih ponuda i podnosenje; zahtjev ide tek kad je sve popunjeno. -->
          <q-card flat bordered>
            <q-card-section>
              <div class="row items-center justify-between q-py-xs text-body2 text-grey-8">
                <span>Osnovica</span>
                <span class="num">{{ money(net) }}</span>
              </div>

              <div class="row items-center justify-between q-py-xs text-body2 text-grey-8">
                <span>PDV {{ vatRate }} %</span>
                <span class="num">{{ money(vat) }}</span>
              </div>

              <q-separator class="q-my-sm" />

              <div class="row items-center justify-between">
                <span class="text-body2 text-weight-medium">Ukupno za uplatu</span>
                <span class="text-h5 text-weight-bold num">{{ money(totalWithVat) }}</span>
              </div>

              <div class="row items-center q-gutter-sm q-mt-md">
                <div v-if="missing.length > 0" class="col text-body2 text-grey-7">
                  Preostaje: {{ missing.join(', ') }}.
                </div>

                <q-space v-else />

                <q-btn
                  outline
                  no-caps
                  color="grey-8"
                  label="Spremi kao nacrt"
                  :loading="saving"
                  @click="saveDraft"
                />

                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  label="Podnesi zahtjev"
                  :disable="missing.length > 0"
                  :loading="saving"
                  @click="submit"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- desno: prilozena ponuda i ostali dokumenti -->
        <div class="col-12 side-column-width">
          <div class="side-column">
            <q-card v-for="offer in offers" :key="offer.id" flat bordered class="q-mb-md">
              <q-card-section class="row items-center no-wrap q-py-sm">
                <div class="text-subtitle1 text-weight-bold col">Priložena ponuda</div>

                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  label="Zamijeni"
                  @click="replace(offer)"
                />
              </q-card-section>

              <q-card-section class="q-pt-none">
                <!-- prva stranica u pregledniku; PDF se salje tek sa zahtjevom -->
                <iframe :src="`${offer.url}#page=1&view=FitH`" class="offer-preview" />

                <div class="text-caption text-grey-7 q-mt-sm ellipsis">
                  {{ offer.file.name }} · {{ Math.round(offer.file.size / 1024) }} kB
                </div>

                <div class="row items-center q-gutter-sm q-mt-sm">
                  <q-btn
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="primary"
                    icon="open_in_new"
                    label="Otvori"
                    @click="preview(offer)"
                  />

                  <q-btn
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="grey-7"
                    icon="refresh"
                    label="Očitaj ponovno"
                    :disable="offer.reading"
                    @click="readOffer(offer)"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="text-subtitle1 text-weight-bold q-pb-sm">
                Dodatni prilozi
              </q-card-section>

              <q-card-section class="q-pt-none">
                <q-list v-if="extras.length > 0" dense class="q-mb-sm">
                  <q-item v-for="extra in extras" :key="extra.id" class="q-px-none">
                    <q-item-section>
                      <q-item-label class="ellipsis text-body2">{{ extra.file.name }}</q-item-label>
                      <q-item-label caption>
                        {{ Math.round(extra.file.size / 1024) }} kB
                      </q-item-label>
                    </q-item-section>

                    <q-item-section side>
                      <q-btn
                        flat
                        dense
                        round
                        size="sm"
                        icon="close"
                        color="grey-7"
                        @click="removeExtra(extra)"
                      >
                        <q-tooltip>Ukloni prilog</q-tooltip>
                      </q-btn>
                    </q-item-section>
                  </q-item>
                </q-list>

                <div
                  class="dropzone dropzone--small column flex-center cursor-pointer text-center q-pa-md"
                  :class="{ 'dropzone--over': extraDragOver }"
                  @click="pickExtra"
                  @dragenter.prevent="extraDragOver = true"
                  @dragover.prevent="extraDragOver = true"
                  @dragleave.prevent="extraDragOver = false"
                  @drop.prevent="dropExtra"
                >
                  <div class="text-body2 text-grey-7">
                    Druga ponuda, specifikacija, e-pošta s dogovorom
                  </div>

                  <div class="text-caption text-grey-6 q-mt-xs">dopušteni PDF, JPG, PNG</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </div>

    <q-file
      ref="offerPicker"
      v-model="pickedOffers"
      multiple
      class="hidden"
      accept="application/pdf"
    />

    <q-file
      ref="extraPicker"
      v-model="pickedExtras"
      multiple
      class="hidden"
      accept="application/pdf,image/jpeg,image/png"
    />
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
const today = dateFormat.format(new Date())

function money(value) {
  return currencyFormat.format(value ?? 0)
}

// Zahtjev moze stajati na vise ponuda; svaka nosi svog dobavljaca i stavke.
const offers = ref([])
const offerPicker = ref(null)
const pickedOffers = ref(null)
const dragOver = ref(false)

// Dokumenti koji se ne ocitavaju - idu uz zahtjev kao popratni.
const extras = ref([])
const extraPicker = ref(null)
const pickedExtras = ref(null)
const extraDragOver = ref(false)

let lastId = 0

// Ocitava se samo PDF: slike s mobitela model cita osjetno losije.
const offerTypes = new Set(['application/pdf'])
const extraTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])

// PDV po stavci jos nije na ponudi, pa zahtjev ide sa zadanom stopom.
const vatRate = 25

// Zamjena pamti koju ponudu nova zamjenjuje; obican odabir to ponisti.
let replacing = null

function pickOffer() {
  replacing = null
  offerPicker.value?.pickFiles()
}

function replace(offer) {
  offerPicker.value?.pickFiles()
  replacing = offer
}

/** Nova ponuda preuzima mjesto one koju mijenja, pa se redoslijed ne mijesa. */
function replaceWith(fresh) {
  if (replacing === null || fresh === undefined) {
    return
  }

  const index = offers.value.indexOf(replacing)

  offers.value = offers.value.filter((offer) => offer !== fresh)
  offers.value.splice(index, 0, fresh)

  removeOffer(replacing)
  replacing = null
}

function pickExtra() {
  extraPicker.value?.pickFiles()
}

/**
 * Ponudu cita lokalni model preko servera. Rezultat je prijedlog: dobavljac i
 * stavke se upisuju u blok te ponude, a podnositelj ih moze ispraviti.
 */
async function readOffer(offer) {
  if (offer.reading) {
    return
  }

  offer.reading = true
  offer.error = null

  try {
    const result = await gimmiApi.readOffer(offer.file)

    offer.supplier = {
      name: result.supplier?.name ?? '',
      oib: result.supplier?.oib ?? '',
      offerNumber: result.supplier?.offerNumber ?? '',
      issuedAt: result.supplier?.issuedAt ?? '',
      validUntil: result.supplier?.validUntil ?? '',
    }

    offer.recognised = true
    offer.net = result.netTotal ?? 0
    offer.vat = result.vatAmount ?? 0
    offer.total = result.totalWithVat ?? 0
    offer.tookMs = result.tookMs ?? 0

    offer.items = result.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))

    if (result.items.length === 0) {
      offer.error = 'Model nije prepoznao nijednu stavku na ovoj ponudi.'
    }
  } catch (err) {
    offer.error = err.response?.data?.error ?? `Očitavanje nije uspjelo: ${err.message}`
  } finally {
    offer.reading = false
  }
}

function addOffer(file) {
  if (!offerTypes.has(file.type)) {
    $q.notify({ type: 'warning', message: `"${file.name}" nije PDF, pa nije dodana.` })
    return null
  }

  // reactive, a ne obican objekt: ocitavanje ga mijenja nakon sto je vec u
  // listi, a te promjene sucelje mora vidjeti
  const offer = reactive({
    id: ++lastId,
    file,
    // Datoteka se prikazuje i otvara iz preglednika; objectURL se mora osloboditi.
    url: URL.createObjectURL(file),
    supplier: { name: '', oib: '', offerNumber: '', issuedAt: '', validUntil: '' },
    recognised: false,
    items: [],
    net: 0,
    vat: 0,
    total: 0,
    reading: false,
    error: null,
    tookMs: 0,
  })

  offers.value.push(offer)
  readOffer(offer)

  return offer
}

function addOffers(files) {
  const added = []

  for (const file of files ?? []) {
    const offer = addOffer(file)

    if (offer !== null) {
      added.push(offer)
    }
  }

  replaceWith(added[0])
}

function dropOffer(event) {
  dragOver.value = false
  addOffers(event.dataTransfer?.files)
}

watch(pickedOffers, (files) => {
  if (files?.length) {
    addOffers(files)
    pickedOffers.value = null
  }
})

function removeOffer(offer) {
  URL.revokeObjectURL(offer.url)
  offers.value = offers.value.filter((other) => other.id !== offer.id)
}

function preview(offer) {
  window.open(offer.url, '_blank')
}

function addExtra(file) {
  if (!extraTypes.has(file.type)) {
    $q.notify({ type: 'warning', message: `"${file.name}" nije PDF, JPG ni PNG.` })
    return
  }

  extras.value.push({ id: ++lastId, file })
}

function addExtras(files) {
  for (const file of files ?? []) {
    addExtra(file)
  }
}

function dropExtra(event) {
  extraDragOver.value = false
  addExtras(event.dataTransfer?.files)
}

watch(pickedExtras, (files) => {
  if (files?.length) {
    addExtras(files)
    pickedExtras.value = null
  }
})

function removeExtra(extra) {
  extras.value = extras.value.filter((other) => other.id !== extra.id)
}

onBeforeUnmount(() => {
  for (const offer of offers.value) {
    URL.revokeObjectURL(offer.url)
  }
})

// Stavke se uredjuju jedna po jedna, pa redak inace ostaje citak.
const editing = ref(null)

function itemKey(offer, index) {
  return `${offer.id}:${index}`
}

function addItem(offer) {
  offer.items.push({ name: '', quantity: 1, unitPrice: 0 })
  editing.value = itemKey(offer, offer.items.length - 1)
}

function removeItem(offer, index) {
  offer.items.splice(index, 1)
  editing.value = null
}

function lineTotal(item) {
  return (item.quantity ?? 0) * (item.unitPrice ?? 0)
}

/**
 * Iznosi se izvode iz stavki, a ne prepisuju s ponude: podnositelj stavke
 * mijenja, pa zbroj mora pratiti ono sto je na ekranu.
 */
function derivedNet(offer) {
  return offer.items.reduce((sum, item) => sum + lineTotal(item), 0)
}

function derivedVat(offer) {
  return (derivedNet(offer) * vatRate) / 100
}

function derivedTotal(offer) {
  return derivedNet(offer) + derivedVat(offer)
}

// Model zna prepisati jedan iznos krivo; usporedba sa zbrojem stavki to otkrije.
function offerDiffers(offer) {
  return offer.total > 0 && Math.abs(derivedTotal(offer) - offer.total) > 0.01
}

const items = computed(() => offers.value.flatMap((offer) => offer.items))

const net = computed(() => offers.value.reduce((sum, offer) => sum + derivedNet(offer), 0))
const vat = computed(() => offers.value.reduce((sum, offer) => sum + derivedVat(offer), 0))
const totalWithVat = computed(() => net.value + vat.value)

const justification = ref('')
const note = ref('')
const costCentre = ref(null)
const costCentreOptions = ref([])
const loadingCostCentres = ref(false)

const justificationDone = computed(() => justification.value.trim().length > 0)

const offersDetail = computed(() =>
  offers.value.map((offer) => offer.supplier.name || offer.file.name).join(', '),
)

// Ista provjera stoji u zaglavlju i na gumbu: bez ovoga zahtjev ne ide dalje.
const checklist = computed(() => [
  {
    label: offers.value.length > 1 ? 'Ponude priložene' : 'Ponuda priložena',
    detail: offersDetail.value || 'obavezno',
    done: offers.value.length > 0 && items.value.length > 0,
  },
  {
    label: 'Svrha nabave',
    detail: justificationDone.value ? 'ispunjeno' : 'obavezno polje',
    done: justificationDone.value,
  },
  {
    label: 'Služba ili projekt',
    detail: costCentre.value?.label ?? 'nije odabrano',
    done: costCentre.value !== null,
  },
])

const hasInput = computed(
  () =>
    offers.value.length > 0 ||
    extras.value.length > 0 ||
    justification.value.trim().length > 0 ||
    note.value.trim().length > 0 ||
    costCentre.value !== null,
)

const missing = computed(() => {
  const fields = []

  if (offers.value.length === 0) {
    fields.push('ponuda')
  }

  if (items.value.length === 0) {
    fields.push('stavke')
  }

  if (!justificationDone.value) {
    fields.push('svrha nabave')
  }

  if (costCentre.value === null) {
    fields.push('služba')
  }

  return fields
})

onMounted(async () => {
  loadingCostCentres.value = true

  try {
    const budgets = await gimmiApi.getDepartmentBudgets()

    costCentreOptions.value = budgets.map((budget) => ({
      ...budget,
      label: `${budget.department_name}${budget.kind === 'PROJECT' ? ' (projekt)' : ''}`,
    }))
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.response?.data?.error ?? 'Dohvat šifrarnika nije uspio',
    })
  } finally {
    loadingCostCentres.value = false
  }
})

const saving = ref(false)

/**
 * Zahtjev uvijek nastaje kao nacrt; podnosenje je zaseban korak jer server
 * pri njemu provjerava pravila (prilozena ponuda, ovlasti, komentar).
 * Kategorija stavke ostaje prazna - dodjeljuje je nabava pri obradi.
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
      amounts: { net: net.value, vat: vat.value, total: totalWithVat.value },
      items: items.value.map((item) => ({
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        vat_rate: vatRate,
      })),
    })

    const id = request.id_purchase_request

    // Prva ponuda je uvjet za podnosenje; ostale idu kao usporedni dokumenti.
    for (const [index, offer] of offers.value.entries()) {
      await gimmiApi.addAttachment(id, offer.file, index === 0 ? 'OFFER' : 'OTHER')
    }

    for (const extra of extras.value) {
      await gimmiApi.addAttachment(id, extra.file, 'OTHER')
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

// Server veze nacrt uz troskovno mjesto, pa se ni nacrt bez njega ne moze spremiti.
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

// Prazan obrazac nema sto izgubiti, pa odustajanje tada ide bez pitanja.
function cancel() {
  if (!hasInput.value) {
    router.push('/zahtjevi')
    return
  }

  $q.dialog({
    title: 'Odbaci nacrt',
    message: 'Uneseni podaci neće biti spremljeni. Nastaviti?',
    cancel: { flat: true, noCaps: true, label: 'Odustani' },
    ok: { unelevated: true, noCaps: true, color: 'negative', label: 'Odbaci' },
  }).onOk(() => router.push('/zahtjevi'))
}
</script>

<style scoped>
/* Sredina drzi omjer blizak 4:3 prema visini prozora, pa se na sirokom ekranu
   ne razvlaci preko cijele sirine. Prilozi desno uzimaju 28 % sirine, pa se
   ukupna mjera dijeli tim udjelom - inace bi sredina ostala uza od 4:3. */
@media (min-width: 1024px) {
  .request-layout {
    max-width: calc(100vh * 4 / 3 / 0.72 + 16px);
    margin-left: auto;
    margin-right: 0;
    padding-right: 0;
  }

  /* Prilozi drze nesto manje od trecine sirine, kao na predlosku; ispod te
     mjere prikaz ponude postane preuzak, pa vrijedi sirina ladice. */
  .side-column-width {
    width: 28%;
    flex: 0 0 28%;
    min-width: var(--gimmi-side-width);
  }

  .side-column-width .side-column {
    padding-right: 16px;
  }

  /* prilozi ostaju pri ruci i kad je popis stavki dug */
  .side-column {
    position: sticky;
    top: 24px;
  }
}

/* ista visina kao zaglavlje ladice, pa blokovi krecu u ravnini s njezinom crtom */
.page-header {
  height: var(--gimmi-drawer-header);
}

/* provjera u zaglavlju odlazi prva kad ekran postane tijesan */
@media (max-width: 1279px) {
  .page-header .text-body2 {
    display: none;
  }
}

/* Zona za prijenos mora se vidjeti kad datoteka dodje iznad nje. */
.dropzone {
  min-height: 186px;
  border: 1px dashed rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  transition:
    background 0.15s,
    border-color 0.15s;
}

/* kad ponuda vec postoji, zona se svede na jedan red */
.dropzone--small {
  min-height: 0;
  padding: 12px;
}

.dropzone--over {
  border-color: var(--q-primary);
  background: rgba(25, 118, 210, 0.06);
}

/* chip uz dobavljaca govori da podatke nije upisao covjek */
.recognised-chip {
  border-style: dashed;
}

.meta-chip {
  font-size: 12px;
}

/* prva stranica ponude, tek toliko da se prepozna koji je dokument */
.offer-preview {
  width: 100%;
  height: 320px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  background: #fff;
}

/* svako polje za unos nosi istaknutu oznaku */
.field-label {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

/* svrha nabave se rasteze do dna stupca, pored sluzbe i napomene */
.purpose-field {
  min-height: 120px;
}

.purpose-field :deep(.q-field__control),
.purpose-field :deep(.q-field__native) {
  height: 100%;
}

.items-table :deep(th) {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.items-table :deep(td) {
  vertical-align: middle;
}

/* redovi zbroja nemaju crtu ispod, samo jednu iznad prvog */
.items-table :deep(tr.sum-row td) {
  border-bottom: none;
}

.items-table :deep(tr.sum-row:first-of-type td) {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

/* brojke se poravnavaju po znamenkama */
.num {
  font-variant-numeric: tabular-nums;
}
</style>
