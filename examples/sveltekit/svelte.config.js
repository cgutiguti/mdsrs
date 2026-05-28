import adapter from '@sveltejs/adapter-static';

const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: undefined,
			strict: false
		}),
		paths: {
			base
		}
	}
};

export default config;
