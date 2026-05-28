<script lang="ts">
	import {
		chartPointerTime,
		chartWidth,
		dateLabel,
		gradeChartLeft,
		gradeChartRight,
		gradeDisplayValue,
		gradePoints,
		gradeX,
		gradeY,
		hoverDateLabel,
		hoverX,
		metricChartLeft,
		metricChartRight,
		metricDisplayValue,
		metrics,
		recallAxisLabel,
		recallChartBottom,
		recallChartLeft,
		recallChartRight,
		recallChartTop,
		recallCurvePath,
		recallDisplayValue,
		recallDomain,
		recallReviewMarkers,
		recallY,
		seriesPoints,
		showDesiredRecallLine,
		type ReviewGrade,
		type ReviewHistoryEntry
	} from './charts';

	let { history }: { history: ReviewHistoryEntry[] } = $props();
	let hoverTime = $state<number | null>(null);

	const updateHoverTime = (event: PointerEvent, left = 0, right = chartWidth) => {
		hoverTime = chartPointerTime(event, history, left, right);
	};

	const clearHoverTime = () => {
		hoverTime = null;
	};

	const gradeClass = (grade: ReviewGrade) => `grade-${grade}`;
</script>

<section class="history-panel">
	<div class="history-heading">
		<p>review history</p>
		<p>{history.length} reviews</p>
	</div>

	{#if history.length === 0}
		<div class="history-empty">no reviews yet</div>
	{:else}
		<div class="history-grid">
			<div class="history-chart">
				<div class="history-chart-heading">
					<p>grades</p>
					<p>{hoverTime == null ? dateLabel(history.at(-1)!.reviewedAt) : hoverDateLabel(hoverTime)} · {gradeDisplayValue(history, hoverTime ?? new Date(history.at(-1)!.reviewedAt).getTime())}</p>
				</div>
				<svg
					class="history-svg"
					viewBox="0 0 320 64"
					role="img"
					aria-label="Review grades over time"
					onpointerdown={(event) => updateHoverTime(event, gradeChartLeft, gradeChartRight)}
					onpointermove={(event) => updateHoverTime(event, gradeChartLeft, gradeChartRight)}
					onpointerleave={clearHoverTime}
				>
					{#each ['easy', 'good', 'hard', 'forgot'] as grade (grade)}
						<line
							x1={gradeChartLeft}
							x2={gradeChartRight}
							y1={gradeY[grade as ReviewGrade]}
							y2={gradeY[grade as ReviewGrade]}
							class="history-gridline"
						/>
						<text x="0" y={gradeY[grade as ReviewGrade] - 3} class="history-axis-label"
							>{grade}</text
						>
					{/each}
					<polyline points={gradePoints(history)} fill="none" class="history-line" />
					{#each history as review (review.reviewId)}
						<circle
							cx={gradeX(review, history)}
							cy={gradeY[review.grade]}
							r="4"
							class={`history-dot ${gradeClass(review.grade)}`}
						/>
					{/each}
					{#if hoverX(hoverTime, history, gradeChartLeft, gradeChartRight) != null}
						<line
							x1={hoverX(hoverTime, history, gradeChartLeft, gradeChartRight)}
							x2={hoverX(hoverTime, history, gradeChartLeft, gradeChartRight)}
							y1="4"
							y2="58"
							class="history-hover-line"
						/>
					{/if}
					<rect x={gradeChartLeft} y="0" width={gradeChartRight - gradeChartLeft} height="64" fill="transparent" />
				</svg>
			</div>

			<div class="history-chart">
				<div class="history-chart-heading">
					<p>schedule</p>
					<p>{hoverTime == null ? `due ${history.at(-1)!.dueDate}` : `${hoverDateLabel(hoverTime)} · ${recallDisplayValue(history, hoverTime)}`}</p>
				</div>
				<svg
					class="history-svg history-svg-tall"
					viewBox="0 0 320 96"
					role="img"
					aria-label="Modeled recall curve"
					onpointerdown={(event) => updateHoverTime(event, recallChartLeft, recallChartRight)}
					onpointermove={(event) => updateHoverTime(event, recallChartLeft, recallChartRight)}
					onpointerleave={clearHoverTime}
				>
					<line x1={recallChartLeft} x2={recallChartRight} y1={recallChartTop} y2={recallChartTop} class="history-gridline" />
					{#if showDesiredRecallLine(history)}
						<line
							x1={recallChartLeft}
							x2={recallChartRight}
							y1={recallY(0.9, history)}
							y2={recallY(0.9, history)}
							class="history-gridline history-dashed"
						/>
					{/if}
					<line x1={recallChartLeft} x2={recallChartRight} y1={recallChartBottom} y2={recallChartBottom} class="history-gridline" />
					<text x="0" y={recallChartTop + 3} class="history-axis-label"
						>{recallAxisLabel(recallDomain(history).max)}</text
					>
					{#if showDesiredRecallLine(history)}
						<text x="0" y={recallY(0.9, history) + 3} class="history-axis-label">90%</text>
					{/if}
					<text x="0" y={recallChartBottom + 3} class="history-axis-label">
						{recallAxisLabel(recallDomain(history).min)}
					</text>
					{#each recallCurvePath(history)
						.split(' M')
						.filter(Boolean) as segment, segmentIndex (segmentIndex)}
						<path d={segmentIndex === 0 ? segment : `M${segment}`} fill="none" class="history-line" />
					{/each}
					{#each recallReviewMarkers(history) as marker (marker.reviewId)}
						<line x1={marker.x} x2={marker.x} y1={recallChartTop} y2={recallChartBottom} class="history-gridline" />
						<circle
							cx={marker.x}
							cy={recallY(marker.preReviewRecall, history)}
							r="3"
							class={`history-dot ${gradeClass(marker.grade)}`}
						/>
					{/each}
					{#if hoverX(hoverTime, history, recallChartLeft, recallChartRight) != null}
						<line
							x1={hoverX(hoverTime, history, recallChartLeft, recallChartRight)}
							x2={hoverX(hoverTime, history, recallChartLeft, recallChartRight)}
							y1={recallChartTop}
							y2={recallChartBottom}
							class="history-hover-line"
						/>
					{/if}
					<rect x={recallChartLeft} y="0" width={recallChartRight - recallChartLeft} height="96" fill="transparent" />
				</svg>
			</div>

			<div class="history-metrics">
				{#each metrics as metric (metric.key)}
					<div class="history-chart history-metric">
						<div class="history-chart-heading">
							<p>{metric.label}</p>
							<p>{metricDisplayValue(history, metric.key, hoverTime)}{metric.key === 'intervalDays' ? 'd' : ''}</p>
						</div>
						<svg
							class="history-svg history-svg-small"
							viewBox="0 0 320 56"
							role="img"
							aria-label={`${metric.label} over time`}
							onpointerdown={(event) => updateHoverTime(event, metricChartLeft, metricChartRight)}
							onpointermove={(event) => updateHoverTime(event, metricChartLeft, metricChartRight)}
							onpointerleave={clearHoverTime}
						>
							<polyline
								points={seriesPoints(history, metric.key, chartWidth, 56, metricChartLeft, metricChartRight)}
								fill="none"
								class="history-line"
							/>
							{#if hoverX(hoverTime, history, metricChartLeft, metricChartRight) != null}
								<line
									x1={hoverX(hoverTime, history, metricChartLeft, metricChartRight)}
									x2={hoverX(hoverTime, history, metricChartLeft, metricChartRight)}
									y1="4"
									y2="52"
									class="history-hover-line"
								/>
							{/if}
							<rect x={metricChartLeft} y="0" width={metricChartRight - metricChartLeft} height="56" fill="transparent" />
						</svg>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>
