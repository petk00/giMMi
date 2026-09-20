<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-white text-primary">
      <q-toolbar>
        <!-- logo otvara i zatvara ladicu -->
        <q-btn
          flat
          dense
          no-caps
          aria-label="Prikaži ili sakrij izbornik"
          class="q-mr-sm"
          @click="toggleLeftDrawer"
        >
          <img alt="giMMi" src="~assets/gimmi-logo.jpg" class="gimmi-logo" />
        </q-btn>

        <q-toolbar-title class="text-subtitle1">{{ $route.meta.title }}</q-toolbar-title>

        <!-- broj obavijesti je placeholder dok ne postoji izvor podataka -->
        <q-btn flat round dense icon="notifications" aria-label="Obavijesti" class="q-mr-sm">
          <q-badge color="red" floating>3</q-badge>
        </q-btn>

        <q-btn unelevated color="primary" icon="add" label="Novi zahtjev" to="/zahtjevi/novi" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered class="column no-wrap">
      <q-list class="col scroll q-pt-sm">
        <template v-for="section in menuSections" :key="section.label ?? 'glavno'">
          <q-item-label v-if="section.label" header>{{ section.label }}</q-item-label>

          <q-item
            v-for="item in section.items"
            :key="item.to"
            v-ripple
            clickable
            :to="item.to"
            exact
            active-class="text-primary"
          >
            <q-item-section avatar>
              <q-icon :name="item.icon" />
            </q-item-section>

            <q-item-section>{{ item.title }}</q-item-section>
          </q-item>
        </template>
      </q-list>

      <q-separator />

      <!-- prijavljeni korisnik - staticki dok ne postoji prijava -->
      <q-item class="q-py-md">
        <q-item-section avatar>
          <q-avatar size="36px" color="grey-3" text-color="grey-8" icon="person" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-medium">{{ currentUser.name }}</q-item-label>
          <q-item-label caption>{{ currentUser.role }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'

const menuSections = [
  {
    label: null,
    items: [
      { title: 'Moji zahtjevi', icon: 'assignment', to: '/zahtjevi' },
      { title: 'Novi zahtjev', icon: 'add_circle_outline', to: '/zahtjevi/novi' },
    ],
  },
  {
    label: 'Nabava',
    items: [
      { title: 'Zahtjevi', icon: 'fact_check', to: '/nabava/zahtjevi' },
      { title: 'Narudžbe', icon: 'shopping_cart', to: '/narudzbe' },
      { title: 'Katalog', icon: 'menu_book', to: '/katalog' },
    ],
  },
  {
    label: 'Pomoć',
    items: [
      { title: 'Kako podnijeti zahtjev', icon: 'help_outline', to: '/pomoc/podnosenje-zahtjeva' },
      { title: 'Kontakt računovodstva', icon: 'mail_outline', to: '/pomoc/kontakt' },
    ],
  },
  {
    label: 'Financije',
    items: [
      { title: 'Kategorije', icon: 'category', to: '/kategorije' },
      { title: 'Službe i projekti', icon: 'account_tree', to: '/sluzbe-i-projekti' },
      { title: 'Knjiženja', icon: 'receipt_long', to: '/knjizenja' },
    ],
  },
  {
    label: 'Ostalo',
    items: [
      { title: 'Dobavljači', icon: 'local_shipping', to: '/dobavljaci' },
      { title: 'Izvještaji', icon: 'bar_chart', to: '/izvjestaji' },
    ],
  },
  {
    label: 'Administracija',
    items: [{ title: 'Korisnici', icon: 'group', to: '/korisnici' }],
  },
]

// Placeholder dok se ne napravi prijava; tada ide iz AppUser tablice.
const currentUser = { name: 'Marija Novak', role: 'Operator' }

const leftDrawerOpen = ref(true)

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
</script>

<style scoped>
.gimmi-logo {
  height: 40px;
  width: auto;
  display: block;
}
</style>
