import { createApp } from 'vue';
import App from './App.vue';

// The bare side-effect import. It exports nothing — it registers the icon
// collections the plugin found into @iconify/vue's runtime, so every <Icon>
// below resolves without a network request. Import it once, at the entry.
import 'virtual:iconify-bundle';

createApp(App).mount('#app');
