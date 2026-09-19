// Svi ekrani osim pocetnog su zasad PlaceholderPage - naslov im dolazi iz meta.title.
const placeholder = () => import('pages/PlaceholderPage.vue')

const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      // pocetna stranica nakon prijave
      { path: '', redirect: '/zahtjevi' },

      { path: 'zahtjevi', component: placeholder, meta: { title: 'Moji zahtjevi' } },

      // pregled stanja veze s bazom, nije u izborniku
      {
        path: 'pregled',
        component: () => import('pages/IndexPage.vue'),
        meta: { title: 'Pregled' },
      },
      { path: 'zahtjevi/novi', component: placeholder, meta: { title: 'Novi zahtjev' } },
      { path: 'nabava/zahtjevi', component: placeholder, meta: { title: 'Zahtjevi' } },
      { path: 'narudzbe', component: placeholder, meta: { title: 'Narudžbe' } },

      { path: 'kategorije', component: placeholder, meta: { title: 'Kategorije' } },
      { path: 'sluzbe-i-projekti', component: placeholder, meta: { title: 'Službe i projekti' } },
      { path: 'knjizenja', component: placeholder, meta: { title: 'Knjiženja' } },

      { path: 'katalog', component: placeholder, meta: { title: 'Katalog' } },
      { path: 'dobavljaci', component: placeholder, meta: { title: 'Dobavljači' } },
      { path: 'izvjestaji', component: placeholder, meta: { title: 'Izvještaji' } },

      { path: 'korisnici', component: placeholder, meta: { title: 'Korisnici' } },

      {
        path: 'pomoc/podnosenje-zahtjeva',
        component: placeholder,
        meta: { title: 'Kako podnijeti zahtjev' },
      },
      {
        path: 'pomoc/kontakt',
        component: placeholder,
        meta: { title: 'Kontakt računovodstva' },
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
