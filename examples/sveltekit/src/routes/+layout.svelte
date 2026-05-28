<script lang="ts">
	import { base } from '$app/paths';
	import 'katex/dist/katex.min.css';
	import '../app.css';

	let { children } = $props();
</script>

<header class="site-header">
	<div class="site-header-inner">
		<p class="site-title">mdsrs SvelteKit example</p>
		<nav class="nav" aria-label="Primary">
			<a href={`${base}/`}>docs</a>
			<a href={`${base}/browse`}>browse</a>
		</nav>
	</div>
</header>

{@render children()}
