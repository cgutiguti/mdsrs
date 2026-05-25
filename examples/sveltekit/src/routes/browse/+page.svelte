<script lang="ts">
	let { data } = $props();
</script>

<main>
	<h1>Browse</h1>

	<section>
		<h2>Decks</h2>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Deck</th>
						<th>Direct cards</th>
						<th>Total cards</th>
					</tr>
				</thead>
				<tbody>
					{#each data.deckTree as deck}
						<tr>
							<td><code>{deck.path}</code></td>
							<td>{deck.cardCount}</td>
							<td>{deck.totalCardCount}</td>
						</tr>
						{#each deck.children as child}
							<tr>
								<td><code>{child.path}</code></td>
								<td>{child.cardCount}</td>
								<td>{child.totalCardCount}</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>Cards</h2>
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
	</section>
</main>
