<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat dense no-caps icon="arrow_back" label="Odustani" to="/zahtjevi" />
    </div>

    <q-stepper v-model="step" flat bordered header-nav animated color="primary">
      <!-- 1. ponuda -->
      <q-step :name="1" title="Ponuda" icon="description" :done="step > 1">
        <div class="text-body2 text-grey-7 q-mb-md">
          Priložite ponudu dobavljača; podaci se iz nje prepisuju u zahtjev.
        </div>

        <div class="dropzone column flex-center q-pa-xl">
          <q-icon name="cloud_upload" size="40px" color="grey-6" />
          <div class="q-mt-sm text-body2 text-grey-7">
            Prijenos povlačenjem ili slikanjem mobitelom; dopušteni PDF, JPG, PNG
          </div>

          <q-file
            v-model="offerFile"
            outlined
            dense
            class="q-mt-md"
            style="max-width: 320px"
            label="Odaberite datoteku"
            accept=".pdf,image/jpeg,image/png"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
        </div>

        <q-banner v-if="offerFile" class="bg-green-1 text-green-9 q-mt-md" dense>
          Prepoznato iz ponude: dobavljač i {{ items.length }} stavke.
        </q-banner>
      </q-step>

      <!-- 2. stavke -->
      <q-step :name="2" title="Stavke" icon="list_alt" :done="step > 2">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-8">
            <q-card flat bordered class="q-mb-md">
              <q-card-section class="row items-center q-gutter-sm">
                <div class="text-subtitle1">Dobavljač</div>
                <q-chip dense outline color="grey-7" label="prepoznato iz ponude" />
              </q-card-section>

              <q-card-section class="row q-col-gutter-md q-pt-none">
                <q-input
                  v-model="supplier.name"
                  outlined
                  dense
                  label="Naziv"
                  class="col-12 col-sm-6"
                />
                <q-input
                  v-model="supplier.oib"
                  outlined
                  dense
                  label="OIB"
                  class="col-12 col-sm-6"
                />
                <q-input
                  v-model="supplier.offerNumber"
                  outlined
                  dense
                  label="Broj ponude"
                  class="col-12 col-sm-6"
                />
                <q-input
                  v-model="supplier.validUntil"
                  outlined
                  dense
                  label="Ponuda vrijedi do"
                  mask="##.##.####."
                  class="col-12 col-sm-6"
                />
              </q-card-section>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="row items-center justify-between">
                <div class="text-subtitle1">Stavke</div>
                <q-btn
                  outline
                  dense
                  no-caps
                  color="primary"
                  label="+ Dodaj stavku"
                  @click="addItem"
                />
              </q-card-section>

              <q-markup-table flat square separator="horizontal">
                <thead>
                  <tr class="text-grey-7">
                    <th class="text-left">Naziv</th>
                    <th class="text-right">Količina</th>
                    <th class="text-right">Jed. cijena</th>
                    <th class="text-right">Ukupno</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="(item, index) in items" :key="index">
                    <td class="text-weight-medium">{{ item.name }}</td>
                    <td class="text-right">{{ item.quantity }} kom</td>
                    <td class="text-right">{{ money(item.unitPrice) }}</td>
                    <td class="text-right">{{ money(item.quantity * item.unitPrice) }}</td>
                    <td class="text-right">
                      <q-btn flat dense round icon="edit" size="sm" @click="editItem(index)" />
                      <q-btn
                        flat
                        dense
                        round
                        icon="delete"
                        size="sm"
                        @click="items.splice(index, 1)"
                      />
                    </td>
                  </tr>

                  <tr v-if="items.length === 0">
                    <td colspan="5" class="text-center text-grey-7 q-py-lg">
                      Još nema stavki. Dodajte ih ručno ili priložite ponudu.
                    </td>
                  </tr>

                  <tr>
                    <td colspan="3" class="text-right text-grey-7">Osnovica</td>
                    <td class="text-right text-weight-medium">{{ money(netTotal) }}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colspan="3" class="text-right text-grey-7">PDV {{ vatRate }} %</td>
                    <td class="text-right">{{ money(vatAmount) }}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colspan="3" class="text-right text-weight-bold">Ukupno s PDV-om</td>
                    <td class="text-right text-weight-bold">{{ money(grossTotal) }}</td>
                    <td />
                  </tr>
                </tbody>
              </q-markup-table>
            </q-card>
          </div>

          <div class="col-12 col-md-4">
            <q-card flat bordered class="q-mb-md">
              <q-card-section class="row items-center justify-between">
                <div class="text-subtitle1">Priložena ponuda</div>
                <q-btn flat dense no-caps color="primary" label="Zamijeni" @click="step = 1" />
              </q-card-section>

              <q-card-section class="q-pt-none">
                <div class="preview column flex-center q-pa-xl text-grey-7">
                  <div>{{ offerFile?.name ?? 'ponuda-4471.pdf' }}</div>
                  <div class="text-caption">prikaz 1. stranice</div>
                </div>

                <div class="text-caption text-grey-7 q-mt-sm">
                  2 stranice · 340 kB · dodano 12.09.2026.
                </div>
              </q-card-section>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="text-subtitle1">Dodatni prilozi</q-card-section>

              <q-card-section class="q-pt-none">
                <div class="dropzone column flex-center q-pa-lg text-center text-grey-7">
                  <div class="text-caption">Druga ponuda, specifikacija, e-pošta s dogovorom</div>
                  <q-file
                    v-model="extraFiles"
                    outlined
                    dense
                    multiple
                    class="q-mt-sm full-width"
                    label="Dodaj priloge"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-step>

      <!-- 3. svrha i troskovno mjesto -->
      <q-step :name="3" title="Svrha i troškovno mjesto" icon="account_tree" :done="step > 3">
        <div class="row q-col-gutter-md">
          <q-input
            v-model="justification"
            outlined
            type="textarea"
            class="col-12 col-md-8"
            label="Svrha nabave"
            hint="Zašto je nabava potrebna; ovo čita osoba koja odobrava"
            :rules="[(value) => !!value || 'Unesite svrhu nabave']"
          />

          <div class="col-12 col-md-4 q-gutter-md">
            <q-select
              v-model="category"
              outlined
              dense
              label="Kategorija"
              :options="categoryOptions"
            />

            <q-select
              v-model="costCentre"
              outlined
              dense
              label="Troškovno mjesto"
              :options="costCentreOptions"
              option-label="label"
              option-value="id_department_budget"
              :loading="loadingCostCentres"
              hint="Služba ili projekt na čiji se proračun troši"
            />

            <q-input v-model="note" outlined dense label="Napomena (nije obavezno)" />
          </div>
        </div>
      </q-step>

      <!-- 4. pregled -->
      <q-step :name="4" title="Pregled" icon="fact_check">
        <q-list bordered separator>
          <q-item>
            <q-item-section>
              <q-item-label caption>Dobavljač</q-item-label>
              <q-item-label>{{ supplier.name || '—' }}</q-item-label>
            </q-item-section>
            <q-item-section side>{{ supplier.offerNumber }}</q-item-section>
          </q-item>

          <q-item v-for="(item, index) in items" :key="index">
            <q-item-section>
              <q-item-label>{{ item.name }}</q-item-label>
              <q-item-label caption>{{ item.quantity }} × {{ money(item.unitPrice) }}</q-item-label>
            </q-item-section>
            <q-item-section side>{{ money(item.quantity * item.unitPrice) }}</q-item-section>
          </q-item>

          <q-item>
            <q-item-section>
              <q-item-label caption>Svrha</q-item-label>
              <q-item-label>{{ justification || '—' }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section>
              <q-item-label caption>Kategorija · Služba</q-item-label>
              <q-item-label>{{ category }} · {{ costCentre?.label ?? '—' }}</q-item-label>
            </q-item-section>
            <q-item-section side class="text-weight-bold">{{ money(grossTotal) }}</q-item-section>
          </q-item>
        </q-list>

        <q-banner class="bg-grey-3 q-mt-md" dense>
          Podnošenjem zahtjev ide operateru nabave na obradu.
        </q-banner>
      </q-step>

      <template #navigation>
        <q-stepper-navigation class="row items-center justify-between">
          <q-btn v-if="step > 1" flat no-caps icon="arrow_back" label="Nazad" @click="step -= 1" />
          <div v-else />

          <div class="q-gutter-sm">
            <q-btn outline no-caps color="primary" label="Spremi kao nacrt" @click="saveDraft" />
            <q-btn
              v-if="step < 4"
              unelevated
              no-caps
              color="primary"
              label="Nastavi"
              icon-right="arrow_forward"
              @click="step += 1"
            />
            <q-btn
              v-else
              unelevated
              no-caps
              color="primary"
              label="Podnesi zahtjev"
              @click="submit"
            />
          </div>
        </q-stepper-navigation>
      </template>
    </q-stepper>

    <!-- dodavanje i uredjivanje stavke -->
    <q-dialog v-model="itemDialog">
      <q-card style="min-width: 360px">
        <q-card-section class="text-subtitle1">
          {{ editedIndex === null ? 'Nova stavka' : 'Uredi stavku' }}
        </q-card-section>

        <q-card-section class="q-gutter-md q-pt-none">
          <q-input v-model="itemDraft.name" outlined dense label="Naziv" autofocus />
          <q-input
            v-model.number="itemDraft.quantity"
            outlined
            dense
            type="number"
            label="Količina"
          />
          <q-input
            v-model.number="itemDraft.unitPrice"
            outlined
            dense
            type="number"
            step="0.01"
            label="Jedinična cijena"
            suffix="€"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Odustani" />
          <q-btn unelevated no-caps color="primary" label="Spremi" @click="saveItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import { gimmiApi } from 'src/services/gimmi-api'

const $q = useQuasar()

const currencyFormat = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' })

function money(value) {
  return currencyFormat.format(value ?? 0)
}

const step = ref(1)

const offerFile = ref(null)
const extraFiles = ref(null)

// Placeholder podaci - zasad se ne salju nikamo.
const supplier = ref({
  name: 'Links d.o.o.',
  oib: '12345678901',
  offerNumber: 'P-4471/2026',
  validUntil: '30.09.2026.',
})

const items = ref([
  { name: 'Prijenosno računalo 14", 16 GB / 512 GB', quantity: 1, unitPrice: 999.2 },
  { name: 'Docking stanica USB-C', quantity: 1, unitPrice: 160 },
])

const vatRate = 25

const netTotal = computed(() =>
  items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
)
const vatAmount = computed(() => (netTotal.value * vatRate) / 100)
const grossTotal = computed(() => netTotal.value + vatAmount.value)

const justification = ref('')
const note = ref('')
const category = ref('Računalna oprema')
const categoryOptions = ['Računalna oprema', 'Uredski materijal', 'Licence i software']

// Troskovno mjesto bira podnositelj: isti covjek moze trositi na vise sluzbi
// i projekata, pa se ne moze izvesti iz njega samog.
const costCentre = ref(null)
const costCentreOptions = ref([])
const loadingCostCentres = ref(false)

onMounted(async () => {
  loadingCostCentres.value = true

  try {
    const budgets = await gimmiApi.getDepartmentBudgets()

    costCentreOptions.value = budgets.map((budget) => ({
      ...budget,
      label: `${budget.department_name}${budget.kind === 'PROJECT' ? ' (projekt)' : ''}`,
    }))
  } catch {
    // u grubom sucelju je dovoljno da popis ostane prazan
  } finally {
    loadingCostCentres.value = false
  }
})

const itemDialog = ref(false)
const editedIndex = ref(null)
const itemDraft = ref({ name: '', quantity: 1, unitPrice: 0 })

function addItem() {
  editedIndex.value = null
  itemDraft.value = { name: '', quantity: 1, unitPrice: 0 }
  itemDialog.value = true
}

function editItem(index) {
  editedIndex.value = index
  itemDraft.value = { ...items.value[index] }
  itemDialog.value = true
}

function saveItem() {
  if (!itemDraft.value.name?.trim()) {
    return
  }

  if (editedIndex.value === null) {
    items.value.push({ ...itemDraft.value })
  } else {
    items.value[editedIndex.value] = { ...itemDraft.value }
  }

  itemDialog.value = false
}

// Spajanje na /api/purchase-requests dolazi u sljedecem koraku.
function saveDraft() {
  $q.notify({ type: 'info', message: 'Nacrt zasad nije spojen na bazu.' })
}

function submit() {
  $q.notify({ type: 'info', message: 'Podnošenje zasad nije spojeno na bazu.' })
}
</script>

<style scoped>
.dropzone {
  border: 1px dashed var(--q-primary);
  border-radius: 6px;
  opacity: 0.85;
}

.preview {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  min-height: 180px;
}
</style>
