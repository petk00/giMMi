<template>
  <div class="login-screen flex flex-center bg-grey-2">
    <q-card flat bordered style="width: 100%; max-width: 380px">
      <q-card-section class="column items-center q-pt-lg">
        <img alt="giMMi" src="~assets/gimmi-logo.jpg" class="login-logo q-mb-sm" />
        <div class="text-body2 text-grey-7">Prijava u sustav nabave</div>
      </q-card-section>

      <q-form @submit="submit">
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="email"
            outlined
            dense
            type="email"
            label="E-mail"
            autocomplete="username"
            :rules="[(value) => !!value || 'Unesite e-mail']"
          >
            <template #prepend>
              <q-icon name="mail_outline" />
            </template>
          </q-input>

          <q-input
            v-model="password"
            outlined
            dense
            type="password"
            label="Lozinka"
            autocomplete="current-password"
            :rules="[(value) => !!value || 'Unesite lozinku']"
          >
            <template #prepend>
              <q-icon name="lock_outline" />
            </template>
          </q-input>

          <q-banner v-if="error" dense class="bg-red-1 text-negative">{{ error }}</q-banner>
        </q-card-section>

        <q-card-actions class="q-px-md q-pb-lg">
          <q-btn
            unelevated
            color="primary"
            class="full-width"
            label="Prijava"
            type="submit"
            :loading="loading"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from 'src/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref(null)

async function submit() {
  loading.value = true
  error.value = null

  try {
    await auth.login(email.value, password.value)
    // nakon prijave natrag na stranicu s koje je korisnik odbijen
    await router.replace(route.query.redirect ?? '/')
  } catch (err) {
    error.value = err.response?.data?.error ?? `Prijava nije uspjela: ${err.message}`
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-screen {
  min-height: 100vh;
}

.login-logo {
  height: 44px;
  width: auto;
}
</style>
