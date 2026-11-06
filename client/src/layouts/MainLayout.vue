<template>
  <q-layout view="lHh Lpr lFf">
    <q-header class="app-header">
      <q-toolbar class="app-toolbar">
        <q-btn
          v-if="$q.screen.lt.lg"
          flat
          dense
          no-caps
          aria-label="Otvori izbornik"
          @click="toggleLeftDrawer"
        >
          <img alt="giMMi" src="~assets/gimmi-logo.jpg" class="brand-logo-small" />
        </q-btn>

        <div v-else class="desktop-brand">
          <img alt="giMMi" src="~assets/gimmi-logo.jpg" class="brand-logo" />
        </div>

        <q-toolbar-title class="app-page-title">
          {{ $route.meta.title }}
        </q-toolbar-title>

        <div class="row items-center no-wrap q-gutter-sm">
          <q-avatar size="34px" color="grey-2" text-color="grey-9" class="text-caption">
            {{ initials }}
          </q-avatar>

          <div v-if="$q.screen.gt.sm" class="column">
            <span class="text-body2 text-weight-medium">{{ auth.fullName }}</span>
            <span class="text-caption text-grey-7">{{ auth.user?.role_name }}</span>
          </div>

          <q-btn
            flat
            dense
            round
            icon="logout"
            aria-label="Odjava"
            :loading="loggingOut"
            @click="logout"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="sideWidth"
      class="column no-wrap"
    >
      <q-list class="col scroll q-pt-sm">
        <template v-for="section in visibleSections" :key="section.label">
          <q-item-label header class="section-label">{{ section.label }}</q-item-label>

          <q-item
            v-for="item in section.items"
            :key="item.to"
            v-ripple
            clickable
            :to="item.to"
            exact
            active-class="menu-item--active"
            class="menu-item"
          >
            <q-item-section avatar class="menu-icon">
              <q-icon :name="item.icon" size="20px" />
            </q-item-section>

            <q-item-section>{{ item.title }}</q-item-section>

            <q-item-section v-if="counts[item.count]" side>
              <q-badge color="grey-3" text-color="grey-9" :label="counts[item.count]" />
            </q-item-section>
          </q-item>
        </template>
      </q-list>

      <q-separator />

      <!-- pomoc stoji na dnu, odvojeno od radnih ekrana -->
      <q-list>
        <q-item
          v-for="item in helpItems"
          :key="item.to"
          v-ripple
          clickable
          :to="item.to"
          exact
          active-class="menu-item--active"
          class="menu-item"
        >
          <q-item-section avatar class="menu-icon">
            <q-icon :name="item.icon" size="20px" />
          </q-item-section>

          <q-item-section>{{ item.title }}</q-item-section>
        </q-item>
      </q-list>

    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { gimmiApi } from 'src/services/gimmi-api'
import { useAuthStore } from 'src/stores/auth'

const auth = useAuthStore()

// Ladica je siroka kao i stupac s karticama desno (--gimmi-side-width).
const sideWidth = 280
const router = useRouter()

const menuSections = [
  {
    label: 'Nabava',
    roles: null,
    items: [
      { title: 'Moji zahtjevi', icon: 'list', to: '/zahtjevi', count: 'submitted' },
      { title: 'Novi zahtjev', icon: 'note_add', to: '/zahtjevi/novi' },
    ],
  },
  {
    label: 'Obrada',
    roles: ['PROCUREMENT'],
    items: [
      { title: 'Zahtjevi', icon: 'fact_check', to: '/nabava/zahtjevi' },
      { title: 'Narudžbe', icon: 'shopping_cart', to: '/narudzbe' },
      { title: 'Katalog', icon: 'menu_book', to: '/katalog' },
    ],
  },
  {
    label: 'Financije',
    roles: ['PROCUREMENT'],
    items: [
      { title: 'Kategorije', icon: 'category', to: '/kategorije' },
      { title: 'Službe i projekti', icon: 'account_tree', to: '/sluzbe-i-projekti' },
      { title: 'Knjiženja', icon: 'receipt_long', to: '/knjizenja' },
    ],
  },
  {
    label: 'Ostalo',
    roles: ['PROCUREMENT'],
    items: [
      { title: 'Dobavljači', icon: 'local_shipping', to: '/dobavljaci' },
      { title: 'Izvještaji', icon: 'bar_chart', to: '/izvjestaji' },
    ],
  },
  {
    label: 'Administracija',
    roles: [],
    items: [{ title: 'Korisnici', icon: 'group', to: '/korisnici' }],
  },
]

const helpItems = [
  { title: 'Kako podnijeti zahtjev', icon: 'help_outline', to: '/pomoc/podnosenje-zahtjeva' },
  { title: 'Kontakt računovodstva', icon: 'mail_outline', to: '/pomoc/kontakt' },
]

// Administrator vidi sve; ostalima se prikazuju samo sekcije za njihovu rolu.
// Ovo je samo sucelje - rute cuva guard, a podatke server.
const visibleSections = computed(() =>
  menuSections.filter(
    (section) =>
      section.roles === null || auth.roleCode === 'ADMIN' || section.roles.includes(auth.roleCode),
  ),
)

const initials = computed(() =>
  [auth.user?.first_name, auth.user?.last_name]
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join(''),
)

const counts = ref({ submitted: 0 })

onMounted(async () => {
  try {
    const requests = await gimmiApi.getMyPurchaseRequests()

    counts.value = {
      submitted: requests.filter((request) => request.status_code !== 'DRAFT').length,
    }
  } catch {
    // brojaci su dodatak, izbornik radi i bez njih
  }
})

const leftDrawerOpen = ref(true)

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

const loggingOut = ref(false)

async function logout() {
  loggingOut.value = true

  try {
    await auth.logout()
    await router.replace('/prijava')
  } finally {
    loggingOut.value = false
  }
}
</script>

<style scoped>
.brand-logo {
  height: 36px;
  width: auto;
  display: block;
}

.brand-logo-small {
  height: 26px;
  width: auto;
  display: block;
}

.desktop-brand {
  width: var(--gimmi-side-width);
  flex: 0 0 var(--gimmi-side-width);
  padding-left: 16px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #89939e;
  padding-bottom: 4px;
}

.menu-item {
  border-radius: 8px;
  margin: 2px 8px;
  min-height: 42px;
}

.menu-item--active {
  background: rgba(22, 137, 154, 0.1);
  color: var(--q-primary);
  font-weight: 600;
}

.menu-icon {
  min-width: 34px;
}

.app-page-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

</style>
