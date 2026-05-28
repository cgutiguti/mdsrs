<script lang="ts">
	import { base } from '$app/paths';

	let { data } = $props();

	const browseHref = (path: string) => `${base}/browse/${path}`;
</script>

<main>
	<nav class="breadcrumb" aria-label="Breadcrumb">
		<a href={`${base}/browse`}>browse</a>
		{#each data.breadcrumbs as crumb}
			<span aria-hidden="true">/</span>
			<a href={browseHref(crumb.path)}>{crumb.name}</a>
		{/each}
	</nav>

	<h1>{data.title}</h1>

	{#if data.childDecks.length > 0}
		<section>
			<h2>Subdecks</h2>
			<div class="deck-grid">
				{#each data.childDecks as deck}
					<a class="deck-link" href={browseHref(deck.path)}>
						<strong>{deck.name}</strong>
						<span class="muted"><code>{deck.path}</code></span>
						<span>{deck.cardCount} direct / {deck.totalCardCount} total cards</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section>
		<h2>Direct cards</h2>

		{#if data.cards.length > 0}
			{#each data.cards as card}
				<article class="card-face">
					<p class="muted">
						{card.deckName} · <code>{card.hash.slice(0, 12)}</code>
						{#if card.performance?.dueDate}
							· due {card.performance.dueDate}
						{/if}
					</p>
					<h3>Front</h3>
					{@html card.frontHtml}
					<h3>Back</h3>
					{@html card.backHtml}
				</article>
			{/each}
		{:else}
			<p class="muted">No cards live directly in this deck.</p>
		{/if}
	</section>
</main>
