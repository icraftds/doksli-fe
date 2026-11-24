<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Icon from '../components/Icon.vue'
import { useTheme } from '../composables/useTheme'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const { theme, toggle } = useTheme()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  if (!email.value || !password.value) {
    errorMsg.value = 'Email dan password harus diisi'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    await authStore.login(email.value, password.value)
    router.push('/dashboard')
  } catch (err: any) {
    errorMsg.value = err?.message || 'Login gagal. Silakan periksa kembali email dan password Anda.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- Theme Toggle -->
    <div class="theme-toggle-wrap">
      <button 
        @click="toggle"
        class="theme-icon-btn"
        :title="theme === 'light' ? 'Ganti ke Mode Gelap' : 'Ganti ke Mode Terang'"
      >
        <Icon :name="theme === 'dark' ? 'moon' : 'sun'" :size="18" />
      </button>
    </div>

    <!-- Login Container -->
    <div class="login-box">
      <!-- Header -->
      <div class="login-head">
        <div class="login-brand-icon">
          <Icon name="lock" :size="24" style="color: var(--accent-contrast)" />
        </div>
        <h1 class="login-brand-title">DoksliApps</h1>
        <p class="login-brand-subtitle">Sistem arsip dokumen terintegrasi</p>
      </div>

      <!-- Form Card -->
      <div class="login-card">
        <!-- Error Notification Banner -->
        <transition name="shake">
          <div v-if="errorMsg" class="login-alert-banner" role="alert">
            <div class="alert-icon-box">
              <Icon name="alert-circle" :size="18" />
            </div>
            <div class="alert-content">
              <span class="alert-title">Gagal Masuk</span>
              <span class="alert-desc">{{ errorMsg }}</span>
            </div>
            <button 
              type="button" 
              class="alert-close-btn" 
              @click="errorMsg = ''" 
              title="Tutup pesan"
            >
              <Icon name="x" :size="14" />
            </button>
          </div>
        </transition>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="login-form">
          <!-- Email -->
          <div class="form-field">
            <label for="login-email" class="field-label">Email</label>
            <InputText 
              id="login-email" 
              v-model="email" 
              type="email" 
              placeholder="nama@instansi.go.id" 
              fluid 
              required
              :invalid="!!errorMsg"
              @input="errorMsg = ''"
            />
          </div>

          <!-- Password -->
          <div class="form-field">
            <label for="login-password" class="field-label">Password</label>
            <Password 
              id="login-password" 
              v-model="password" 
              :feedback="false" 
              toggleMask 
              placeholder="••••••••" 
              fluid 
              required
              :invalid="!!errorMsg"
              @input="errorMsg = ''"
            />
          </div>

          <!-- Submit -->
          <Button 
            type="submit" 
            :label="isLoading ? '' : 'Masuk'" 
            :loading="isLoading" 
            fluid 
            class="submit-btn"
          />
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: var(--bg);
  position: relative;
}

.theme-toggle-wrap {
  position: absolute;
  top: 16px;
  right: 16px;
}

.theme-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-icon-btn:hover {
  background: var(--surface-2);
  border-color: var(--accent);
}

.theme-icon-btn:active {
  transform: scale(0.95);
}

.login-box {
  width: 100%;
  max-width: 420px;
}

.login-head {
  margin-bottom: 24px;
  text-align: center;
}

.login-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  margin-bottom: 12px;
  background: var(--accent);
}

.login-brand-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin: 0;
}

.login-brand-subtitle {
  font-size: 13.5px;
  margin-top: 4px;
  color: var(--text-muted);
}

.login-card {
  border-radius: 14px;
  border: 1px solid var(--border);
  padding: 24px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.submit-btn {
  margin-top: 4px;
  font-weight: 600;
  border-radius: 8px;
}

.login-alert-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--danger-soft);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: var(--danger);
  margin-bottom: 16px;
  animation: alertShake 0.4s ease-in-out;
}

.alert-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.alert-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.alert-desc {
  font-size: 12px;
  opacity: 0.95;
  line-height: 1.4;
}

.alert-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--danger);
  opacity: 0.7;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.15s;
}

.alert-close-btn:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.15);
}

@keyframes alertShake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

@media (max-width: 480px) {
  .login-page {
    padding: 56px 12px 24px;
    align-items: flex-start;
  }

  .login-card {
    padding: 18px;
  }
}

</style>
