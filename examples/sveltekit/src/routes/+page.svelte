<script lang="ts">
	let { data, form } = $props();
	let revealed = $state(false);
	let currentHash = $state<string | null>(null);

	const gradeLabels = [
		['forgot', 'Forgot'],
		['hard', 'Hard'],
		['good', 'Good'],
		['easy', 'Easy']
	] as const;

	$effect(() => {
		const nextHash = data.currentCard?.hash ?? null;
		if (nextHash !== currentHash) {
			currentHash = nextHash;
			revealed = false;
		}
	});
</script>

<main>
	<h1>Review</h1>

	<div class="stats" aria-label="Collection summary">
		<div class="stat">
			<strong>{data.dueCards}</strong>
			<span class="muted">due</span>
		</div>
		<div class="stat">
			<strong>{data.totalCards}</strong>
			<span class="muted">cards</span>
		</div>
		<div class="stat">
			<strong>{data.totalSources}</strong>
			<span class="muted">markdown files</span>
		</div>
		<div class="stat">
			<strong>{data.totalAssets}</strong>
			<span class="muted">assets</span>
		</div>
	</div>

	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	{#if data.currentCard}
		<p class="muted">
			{data.currentCard.deckName} · <code>{data.currentCard.hash.slice(0, 12)}</code>
		</p>

		<section class="card-face" aria-label="Front">
			<h2>Front</h2>
			{@html data.currentCard.frontHtml}
		</section>

		{#if revealed}
			<section class="card-face" aria-label="Back">
				<h2>Back</h2>
				{@html data.currentCard.backHtml}
			</section>

			<form method="POST" action="?/review" class="actions">
				<input type="hidden" name="cardHash" value={data.currentCard.hash} />
				{#each gradeLabels as [grade, label]}
					<button type="submit" name="grade" value={grade}>{label}</button>
				{/each}
			</form>
		{:else}
			<div class="actions">
				<button type="button" onclick={() => (revealed = true)}>Reveal answer</button>
			</div>
		{/if}
	{:else}
		<section class="card-face">
			<h2>Queue empty</h2>
			<p class="muted">All cards in the sample collection are scheduled for the future.</p>
		</section>
	{/if}

	<form method="POST" action="?/reset" class="actions">
		<button type="submit">Reset in-memory reviews</button>
	</form>
</main>
