import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: true,
	// Disabled: prerender run failed resolving fs route paths in this export; re-enable after fixing route discovery.
	prerender: false,
} satisfies Config;
