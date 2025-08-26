import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'

/**
 * Create and export the Vuetify instance used by the app.
 * Inputs: none.
 * Outputs: Vuetify plugin instance.
 * Errors: none.
 */
export const vuetify = createVuetify({
	icons: {
		defaultSet: 'mdi',
		aliases,
		sets: { mdi },
	},
})