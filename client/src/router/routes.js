// Svi ekrani osim pocetnog su zasad PlaceholderPage - naslov im dolazi iz meta.title.
const placeholder = () => import('pages/PlaceholderPage.vue')

const routes = [
  {
    path: '/prijava',
    component: () => import('pages/LoginPage.vue'),
    meta: { title: 'Prijava', public: true },
  },

  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      // pocetna stranica nakon prijave
      { path: '', redirect: '/zahtjevi' },

      {
        path: 'zahtjevi',
        component: () => import('pages/MyRequestsPage.vue'),
        meta: { title: 'Moji zahtjevi' },
      },

      // pregled stanja veze s bazom, nije u izborniku
      {
        path: 'pregled',
        component: () => import('pages/IndexPage.vue'),
        meta: { title: 'Pregled' },
      },
      {
        path: 'zahtjevi/novi',
        component: () => import('pages/NewRequestPage.vue'),
        meta: { title: 'Novi zahtjev' },
      },
      { path: 'zahtjevi/:id', component: placeholder, meta: { title: 'Zahtjev' } },
      {
        path: 'nabava/zahtjevi',
        component: placeholder,
        meta: { title: 'Zahtjevi', roles: ['PROCUREMENT'] },
      },
      {
        path: 'narudzbe',
        component: placeholder,
        meta: { title: 'Narudžbe', roles: ['PROCUREMENT'] },
      },

      {
        path: 'kategorije',
        component: placeholder,
        meta: { title: 'Kategorije', roles: ['PROCUREMENT'] },
      },
      {
        path: 'sluzbe-i-projekti',
        component: placeholder,
        meta: { title: 'Službe i projekti', roles: ['PROCUREMENT'] },
      },
      {
        path: 'knjizenja',
        component: placeholder,
        meta: { title: 'Knjiženja', roles: ['PROCUREMENT'] },
      },

      {
        path: 'katalog',
        component: placeholder,
        meta: { title: 'Katalog', roles: ['PROCUREMENT'] },
      },
      {
        path: 'dobavljaci',
        component: placeholder,
        meta: { title: 'Dobavljači', roles: ['PROCUREMENT'] },
      },
      {
        path: 'izvjestaji',
        component: placeholder,
        meta: { title: 'Izvještaji', roles: ['PROCUREMENT'] },
      },

      {
        path: 'korisnici',
        component: placeholder,
        meta: { title: 'Korisnici', roles: [] },
      },

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
