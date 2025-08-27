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
	theme: {
		defaultTheme: 'light',
		themes: {
			light: {
				colors: {
					primary: '#2563EB',
					secondary: '#64748B',
					success: '#16A34A',
					warning: '#F59E0B',
					error: '#DC2626',
					info: '#0EA5E9',
				},
			},
			dark: {
				colors: {
					primary: '#2563EB',
					secondary: '#94A3B8',
					success: '#22C55E',
					warning: '#F59E0B',
					error: '#EF4444',
					info: '#38BDF8',
				},
			},
		},
	},
	defaults: {
		VBtn: { density: 'comfortable', rounded: 'md' },
		VTextField: { density: 'comfortable', variant: 'outlined' },
		VDialog: { transition: 'dialog-bottom-transition' },
		VCard: { rounded: 'lg' },
	},
})