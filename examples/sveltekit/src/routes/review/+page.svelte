<script lang="ts">
	import { onMount } from 'svelte';
	import type { Grade } from '@mdsrs/core';
	import { createMemoryStore, type MemoryStoreSnapshot } from '@mdsrs/store';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type ReviewCard = PageData['cards'][number];

	const storageKey = 'mdsrs-example-review-v1';
	const gradeLabels = [
		['forgot', 'Forgot'],
		['hard', 'Hard'],
		['good', 'Good'],
		['easy', 'Easy']
	] as const satisfies ReadonlyArray<readonly [Grade, string]>;

	let queue = $state<ReviewCard[]>([]);
	let currentCard = $state<ReviewCard | null>(null);
	let revealed = $state(false);
	let currentHash = $state<string | null>(null);
	let initialized = $state(false);
	let reviewedCount = $state(0);
	let message = $state<string | null>(null);
	let store = createMemoryStore();

	$effect(() => {
		const nextHash = currentCard?.hash ?? null;
		if (nextHash !== currentHash) {
			currentHash = nextHash;
			revealed = false;
		}
	});

	onMount(() => {
		void initializeStore();
	});

	const initializeStore = async () => {
		store = createMemoryStore(readSnapshot());
		await store.syncCards(data.cards);
		await refreshQueue();
		persistSnapshot();
		initialized = true;
	};

	const refreshQueue = async () => {
		const due = await store.getDueCards(data.cards, {
			burySiblings: true
		});
		queue = due.map((item) => item.card as ReviewCard);
		currentCard = queue[0] ?? null;
		reviewedCount = store.snapshot().reviews.length;
	};

	const review = async (grade: Grade) => {
		if (!currentCard) return;
		await store.reviewCard(currentCard.hash, grade);
		persistSnapshot();
		message = `Recorded ${grade}.`;
		await refreshQueue();
	};

	const reset = async () => {
		localStorage.removeItem(storageKey);
		store = createMemoryStore();
		await store.syncCards(data.cards);
		persistSnapshot();
		message = 'Reset local review progress.';
		await refreshQueue();
	};

	const readSnapshot = (): Partial<MemoryStoreSnapshot> | undefined => {
		const value = localStorage.getItem(storageKey);
		if (!value) return undefined;

		try {
			return JSON.parse(value) as Partial<MemoryStoreSnapshot>;
		} catch {
			localStorage.removeItem(storageKey);
			return undefined;
		}
	};

	const persistSnapshot = () => {
		localStorage.setItem(storageKey, JSON.stringify(store.snapshot()));
	};
</script>

<main>
	<h1>Review</h1>
	<p class="muted">This demo saves review progress in this browser with <code>localStorage</code>.</p>

	<div class="stats" aria-label="Collection summary">
		<div class="stat">
			<strong>{initialized ? queue.length : '...'}</strong>
			<span class="muted">due</span>
		</div>
		<div class="stat">
			<strong>{data.totalCards}</strong>
			<span class="muted">cards</span>
		</div>
		<div class="stat">
			<strong>{reviewedCount}</strong>
			<span class="muted">reviews saved</span>
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

	{#if message}
		<p role="status">{message}</p>
	{/if}

	{#if !initialized}
		<section class="card-face">
			<h2>Loading</h2>
			<p class="muted">Opening the local review store.</p>
		</section>
	{:else if currentCard}
		<p class="muted">
			{currentCard.deckName} · <code>{currentCard.hash.slice(0, 12)}</code>
		</p>

		<section class="card-face" aria-label="Front">
			<h2>Front</h2>
			{@html currentCard.frontHtml}
		</section>

		{#if revealed}
			<section class="card-face" aria-label="Back">
				<h2>Back</h2>
				{@html currentCard.backHtml}
			</section>

			<div class="actions">
				{#each gradeLabels as [grade, label]}
					<button type="button" onclick={() => review(grade)}>{label}</button>
				{/each}
			</div>
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

	<div class="actions">
		<button type="button" onclick={reset}>Reset local reviews</button>
	</div>
</main>
