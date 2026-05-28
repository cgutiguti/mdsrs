export type ReviewGrade = 'forgot' | 'hard' | 'good' | 'easy';

export type ReviewHistoryEntry = {
	reviewId: number;
	reviewedAt: string;
	grade: ReviewGrade;
	stability: number;
	difficulty: number;
	intervalRaw: number;
	intervalDays: number;
	dueDate: string;
};

export type MetricKey = 'stability' | 'difficulty' | 'intervalDays';

export const chartWidth = 320;
export const dayMs = 86_400_000;
export const gradeChartLeft = 60;
export const gradeChartRight = 316;
export const recallChartLeft = 52;
export const recallChartRight = 316;
export const recallChartTop = 10;
export const recallChartBottom = 78;
export const metricChartLeft = 52;
export const metricChartRight = 316;
export const metricChartTop = 4;
export const metricChartBottom = 52;

export const gradeY = {
	easy: 10,
	good: 24,
	hard: 38,
	forgot: 52
} satisfies Record<ReviewGrade, number>;

export const metrics = [
	{ label: 'stability', key: 'stability' },
	{ label: 'difficulty', key: 'difficulty' },
	{ label: 'interval', key: 'intervalDays' }
] satisfies { label: string; key: MetricKey }[];

const retrievabilityFactor = 19 / 81;
const retrievabilityDecay = -0.5;

export const rounded = (value: number | null) => (value == null ? 'n/a' : value.toFixed(1));
export const dateLabel = (value: string) =>
	new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
export const hoverDateLabel = (hoverTime: number | null) =>
	hoverTime == null ? null : dateLabel(new Date(hoverTime).toISOString());

export const timelineBounds = (entries: ReviewHistoryEntry[]) => {
	if (entries.length === 0) return null;

	const start = new Date(entries[0]!.reviewedAt).getTime();
	const lastReview = entries.at(-1);
	if (!lastReview) return null;

	const lastReviewTime = new Date(lastReview.reviewedAt).getTime();
	const end = Math.max(
		new Date(lastReview.dueDate).getTime(),
		lastReviewTime + lastReview.intervalDays * dayMs
	);
	const range = Math.max(end - start, 1);

	return { start, end, range };
};

export const timelineX = (
	time: number,
	entries: ReviewHistoryEntry[],
	width = chartWidth,
	left = 0,
	right = width
) => {
	const bounds = timelineBounds(entries);
	if (!bounds) return left + (right - left) / 2;
	return left + ((time - bounds.start) / bounds.range) * (right - left);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const pointerViewX = (event: PointerEvent) => {
	const svg = event.currentTarget as SVGSVGElement;
	const point = svg.createSVGPoint();
	const screenCtm = svg.getScreenCTM();

	if (!screenCtm) {
		const rect = svg.getBoundingClientRect();
		return ((event.clientX - rect.left) / rect.width) * chartWidth;
	}

	point.x = event.clientX;
	point.y = event.clientY;

	return point.matrixTransform(screenCtm.inverse()).x;
};

export const chartPointerTime = (
	event: PointerEvent,
	entries: ReviewHistoryEntry[],
	left: number,
	right: number
) => {
	const bounds = timelineBounds(entries);
	if (!bounds) return null;

	const viewX = pointerViewX(event);
	const ratio = (clamp(viewX, left, right) - left) / (right - left);

	return bounds.start + ratio * bounds.range;
};

export const hoverX = (
	hoverTime: number | null,
	entries: ReviewHistoryEntry[],
	left = 0,
	right = chartWidth
) => (hoverTime == null ? null : timelineX(hoverTime, entries, chartWidth, left, right));

export const gradeX = (review: ReviewHistoryEntry, entries: ReviewHistoryEntry[]) =>
	timelineX(
		new Date(review.reviewedAt).getTime(),
		entries,
		chartWidth,
		gradeChartLeft,
		gradeChartRight
	);

export const gradePoints = (entries: ReviewHistoryEntry[]) =>
	entries
		.map((review) => `${gradeX(review, entries).toFixed(1)},${gradeY[review.grade].toFixed(1)}`)
		.join(' ');

export const nearestReview = (entries: ReviewHistoryEntry[], time: number) =>
	entries.reduce((nearest, review) => {
		const nearestDistance = Math.abs(new Date(nearest.reviewedAt).getTime() - time);
		const reviewDistance = Math.abs(new Date(review.reviewedAt).getTime() - time);
		return reviewDistance < nearestDistance ? review : nearest;
	}, entries[0]!);

export const gradeDisplayValue = (entries: ReviewHistoryEntry[], hoverTime: number | null) => {
	if (hoverTime == null || entries.length === 0) return null;
	return nearestReview(entries, hoverTime).grade;
};

const daysBetween = (left: string, right: string) =>
	(new Date(right).getTime() - new Date(left).getTime()) / dayMs;

const modelRecall = (elapsedDays: number, stability: number) =>
	(1 + retrievabilityFactor * (elapsedDays / stability)) ** retrievabilityDecay;

const recallSampleValues = (entries: ReviewHistoryEntry[]) => {
	const values: number[] = [];

	for (const [index, review] of entries.entries()) {
		const reviewTime = new Date(review.reviewedAt).getTime();
		const nextReviewTime =
			index + 1 < entries.length
				? new Date(entries[index + 1]!.reviewedAt).getTime()
				: Math.max(new Date(review.dueDate).getTime(), reviewTime + review.intervalDays * dayMs);
		const segmentRange = Math.max(nextReviewTime - reviewTime, 1);
		const samples = Math.max(4, Math.min(20, Math.ceil(segmentRange / dayMs)));

		for (let sample = 0; sample <= samples; sample += 1) {
			const elapsedDays = Math.max(0, (segmentRange * sample) / samples / dayMs);
			values.push(modelRecall(elapsedDays, review.stability));
		}
	}

	for (const [index, review] of entries.entries()) {
		const previous = index === 0 ? null : entries[index - 1];
		const elapsedDays = previous ? Math.max(0, daysBetween(previous.reviewedAt, review.reviewedAt)) : 0;
		values.push(previous ? modelRecall(elapsedDays, previous.stability) : 1);
	}

	return values;
};

export const recallDomain = (entries: ReviewHistoryEntry[]) => {
	const values = recallSampleValues(entries);
	if (values.length === 0) return { min: 0, max: 1 };

	const rawMin = Math.max(0, Math.min(...values));
	const rawMax = Math.min(1, Math.max(...values));
	const rawRange = rawMax - rawMin;
	const targetRange = Math.max(rawRange, 0.08);
	const padding = Math.max(0.02, targetRange * 0.15);
	const center = (rawMin + rawMax) / 2;
	const min = Math.max(0, center - targetRange / 2 - padding);
	const max = Math.min(1, center + targetRange / 2 + padding);

	if (max - min < 0.04) {
		return { min: Math.max(0, min - 0.02), max: Math.min(1, max + 0.02) };
	}

	return { min, max };
};

export const recallY = (recall: number, entries: ReviewHistoryEntry[]) => {
	const domain = recallDomain(entries);
	const range = domain.max - domain.min || 1;
	const normalized = (Math.max(domain.min, Math.min(domain.max, recall)) - domain.min) / range;

	return recallChartTop + (1 - normalized) * (recallChartBottom - recallChartTop);
};

export const recallAxisLabel = (value: number) => `${Math.round(value * 100)}%`;
export const showDesiredRecallLine = (entries: ReviewHistoryEntry[]) => {
	const domain = recallDomain(entries);
	return domain.min <= 0.9 && domain.max >= 0.9;
};

export const recallValueAt = (entries: ReviewHistoryEntry[], time: number) => {
	if (entries.length === 0) return null;

	const activeReview =
		entries.find((review, index) => {
			const reviewTime = new Date(review.reviewedAt).getTime();
			const nextReview = entries[index + 1];
			const nextReviewTime = nextReview
				? new Date(nextReview.reviewedAt).getTime()
				: Number.POSITIVE_INFINITY;
			return time >= reviewTime && time <= nextReviewTime;
		}) ?? entries.at(-1)!;

	const elapsedDays = Math.max(0, (time - new Date(activeReview.reviewedAt).getTime()) / dayMs);
	return modelRecall(elapsedDays, activeReview.stability);
};

export const recallDisplayValue = (entries: ReviewHistoryEntry[], hoverTime: number | null) => {
	if (hoverTime == null) return null;
	const value = recallValueAt(entries, hoverTime);
	return value == null ? null : recallAxisLabel(value);
};

export const recallCurvePath = (entries: ReviewHistoryEntry[]) => {
	if (entries.length === 0) return '';

	const bounds = timelineBounds(entries);
	if (!bounds) return '';

	const xForTime = (time: number) =>
		recallChartLeft + ((time - bounds.start) / bounds.range) * (recallChartRight - recallChartLeft);
	const segments: string[] = [];

	for (const [index, review] of entries.entries()) {
		const reviewTime = new Date(review.reviewedAt).getTime();
		const nextReviewTime =
			index + 1 < entries.length
				? new Date(entries[index + 1]!.reviewedAt).getTime()
				: Math.max(new Date(review.dueDate).getTime(), reviewTime + review.intervalDays * dayMs);
		const segmentRange = Math.max(nextReviewTime - reviewTime, 1);
		const samples = Math.max(4, Math.min(20, Math.ceil(segmentRange / dayMs)));

		for (let sample = 0; sample <= samples; sample += 1) {
			const time = reviewTime + (segmentRange * sample) / samples;
			const elapsedDays = Math.max(0, (time - reviewTime) / dayMs);
			const recall = modelRecall(elapsedDays, review.stability);
			const command = sample === 0 ? 'M' : 'L';
			segments.push(`${command}${xForTime(time).toFixed(1)},${recallY(recall, entries).toFixed(1)}`);
		}
	}

	return segments.join(' ');
};

export const recallReviewMarkers = (entries: ReviewHistoryEntry[]) =>
	entries.map((review, index) => {
		const previous = index === 0 ? null : entries[index - 1];
		const elapsedDays = previous ? Math.max(0, daysBetween(previous.reviewedAt, review.reviewedAt)) : 0;
		const preReviewRecall = previous ? modelRecall(elapsedDays, previous.stability) : 1;

		return {
			...review,
			x: timelineX(
				new Date(review.reviewedAt).getTime(),
				entries,
				chartWidth,
				recallChartLeft,
				recallChartRight
			),
			preReviewRecall
		};
	});

export const metricDomain = (entries: ReviewHistoryEntry[], key: MetricKey) => {
	const values = entries.map((entry) => entry[key]);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;
	return { min, max, range };
};

export const metricY = (entries: ReviewHistoryEntry[], key: MetricKey, value: number, height = 56) => {
	const domain = metricDomain(entries, key);
	return height - ((value - domain.min) / domain.range) * (height - 8) - 4;
};

export const seriesPoints = (
	entries: ReviewHistoryEntry[],
	key: MetricKey,
	width = 320,
	height = 56,
	left = 0,
	right = width
) =>
	entries
		.map((entry) => {
			const value = entry[key];
			const x = timelineX(new Date(entry.reviewedAt).getTime(), entries, width, left, right);
			const y = metricY(entries, key, value, height);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(' ');

export const metricValueAt = (entries: ReviewHistoryEntry[], key: MetricKey, time: number) => {
	if (entries.length === 0) return null;
	if (entries.length === 1) return entries[0]![key];

	for (let index = 0; index < entries.length - 1; index += 1) {
		const current = entries[index]!;
		const next = entries[index + 1]!;
		const currentTime = new Date(current.reviewedAt).getTime();
		const nextTime = new Date(next.reviewedAt).getTime();

		if (time >= currentTime && time <= nextTime) {
			const ratio = (time - currentTime) / Math.max(nextTime - currentTime, 1);
			return current[key] + (next[key] - current[key]) * ratio;
		}
	}

	return time < new Date(entries[0]!.reviewedAt).getTime() ? entries[0]![key] : entries.at(-1)![key];
};

export const metricDisplayValue = (
	entries: ReviewHistoryEntry[],
	key: MetricKey,
	hoverTime: number | null
) => {
	const value = hoverTime == null ? entries.at(-1)?.[key] : metricValueAt(entries, key, hoverTime);
	return rounded(value ?? null);
};
