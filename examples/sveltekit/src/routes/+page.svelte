<script lang="ts">
	import { base } from '$app/paths';
</script>

<main>
	<section class="intro">
		<p class="eyebrow">Markdown-native spaced repetition</p>
		<h1>mdsrs</h1>
		<p class="lede">
			mdsrs is a small TypeScript toolkit for building spaced repetition systems from
			plain Markdown files. Cards are readable by people and agents. Card identity is
			based on deterministic hashes. Review state can live in memory, a local JSON file,
			or Postgres.
		</p>
		<div class="actions">
			<a class="button" href={`${base}/review`}>Try the review demo</a>
			<a class="button" href={`${base}/browse`}>Browse the sample cards</a>
			<a class="button" href="https://github.com/cgutiguti/mdsrs">View on GitHub</a>
		</div>
	</section>

	<section>
		<h2>Install</h2>
		<pre><code>pnpm add @mdsrs/core @mdsrs/fs @mdsrs/markdown @mdsrs/store</code></pre>
		<p>
			Add <code>@mdsrs/file-store</code> if you want durable local reviews without
			Postgres. Add <code>@mdsrs/postgres-drizzle</code> if your app already uses
			Postgres and Drizzle.
		</p>
	</section>

	<section>
		<h2>Write cards in Markdown</h2>
		<pre><code>---
name = "Math"
---

Q: What is the derivative of $x^2$?
A: $2x$.

---

C: Euler's identity is $e^&#123;i\pi&#125; + [1] = 0$.</code></pre>
	</section>

	<section>
		<h2>Use a local file store</h2>
		<pre><code>import &#123; loadCollection &#125; from '@mdsrs/fs';
import &#123; createFileStore &#125; from '@mdsrs/file-store';

const collection = await loadCollection('./cards');
const store = await createFileStore('.mdsrs/srs.json');

await store.syncCards(collection.cards);
const queue = await store.getDueCards(collection.cards);
await store.reviewCard(queue[0].card.hash, 'good');</code></pre>
	</section>

	<section>
		<h2>Run the example locally</h2>
		<pre><code>pnpm install
pnpm --filter @mdsrs/example-sveltekit dev</code></pre>
		<p>
			The hosted site is static. The review demo stores progress in this browser with
			<code>localStorage</code>, so it works without a hosted backend.
		</p>
	</section>
</main>
