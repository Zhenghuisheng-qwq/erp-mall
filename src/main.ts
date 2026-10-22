import { createPinia } from 'pinia'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import './theme.css'
import './style.css'
import { applyTheme, readTheme } from './theme'
import { useCatalogStore } from './stores/catalog'
import StoredDataRecovery from './components/StoredDataRecovery.vue'

applyTheme(readTheme())

const pinia = createPinia()
let startupError = ''
try { useCatalogStore(pinia) }
catch (error) { startupError = error instanceof Error ? error.message : String(error) }
const app = startupError ? createApp(StoredDataRecovery, { message: startupError }) : createApp(App)
app.use(pinia)
if (!startupError) app.use(router)
app.use(ElementPlus, { locale: zhCn }).mount('#app')
