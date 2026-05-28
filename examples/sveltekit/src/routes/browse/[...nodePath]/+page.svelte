<script lang="ts">
	import { base } from '$app/paths';
	import ReviewHistoryPanel from './review-history/ReviewHistoryPanel.svelte';

	let { data } = $props();
	let activeHistoryCardHash = $state<string | null>(null);

	const browseHref = (path: string) => `${base}/browse/${path}`;
	const percent = (value: number | null | undefined) => (value == null ? 'n/a' : `${Math.round(value * 100)}%`);
	const rounded = (value: number | null | undefined) => (value == null ? 'n/a' : value.toFixed(1));
	const toggleHistory = (cardHash: string) => {
		activeHistoryCardHash = activeHistoryCardHash === cardHash ? null : cardHash;
	};
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
					<header class="card-header">
						<p class="muted">
							{card.deckName} · <code>{card.hash.slice(0, 12)}</code>
							{#if card.stats?.dueDate}
								· due {card.stats.dueDate}
							{/if}
						</p>
						<p class="muted">{card.filePath}</p>
					</header>
					<div class="card-stats-row">
						<span>{card.stats?.reviewCount ?? 0} reviews</span>
						<span>hit {percent(card.stats?.hitRate)}</span>
						<span>miss {percent(card.stats?.missRate)}</span>
						<span>hard {card.stats?.hardCount ?? 0}</span>
						<span>difficulty {rounded(card.stats?.difficulty)}</span>
						<span>interval {card.stats?.intervalDays ?? 'n/a'}d</span>
						<button
							class="info-button"
							type="button"
							aria-pressed={activeHistoryCardHash === card.hash}
							aria-label={`Toggle review history for ${card.hash.slice(0, 12)}`}
							onclick={() => toggleHistory(card.hash)}
						>
							[i]
						</button>
					</div>
					{#if activeHistoryCardHash === card.hash}
						<ReviewHistoryPanel history={card.history} />
					{:else}
						<div class="card-columns">
							<section>
								<h3>Front</h3>
								{@html card.frontHtml}
							</section>
							<section>
								<h3>Back</h3>
								{@html card.backHtml}
							</section>
						</div>
					{/if}
				</article>
			{/each}
		{:else}
			<p class="muted">No cards live directly in this deck.</p>
		{/if}
	</section>
</main>
