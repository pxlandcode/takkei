<script lang="ts">
	import type {
		SalaryReportAbsenceDetail,
		SalaryReportDetail,
		SalaryReportTrainer
	} from './salaryReportTypes';

	export let trainer: SalaryReportTrainer | null = null;

	const dateFormatter = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium' });
	const dateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	function formatDate(value: string | null | undefined) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		try {
			return dateFormatter.format(date);
		} catch (error) {
			console.warn('Failed to format date', error);
			return value;
		}
	}

	function formatDateTime(value: string | null | undefined) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		try {
			return dateTimeFormatter.format(date);
		} catch (error) {
			console.warn('Failed to format datetime', error);
			return value;
		}
	}

	function minutesToHours(minutes: number) {
		if (!minutes) return 0;
		return Math.round((minutes / 60 + Number.EPSILON) * 100) / 100;
	}

	function formatDayLabel(days: number) {
		return `${days} ${days === 1 ? 'dag' : 'dagar'}`;
	}

	function formatDateRange(entry: SalaryReportAbsenceDetail) {
		if (entry.startDate === entry.endDate) {
			return formatDate(entry.startDate);
		}
		return `${formatDate(entry.startDate)} – ${formatDate(entry.endDate)}`;
	}

	function formatAbsenceMeta(entry: SalaryReportAbsenceDetail) {
		const parts: string[] = [];
		parts.push(entry.source === 'vacation' ? 'Semester' : 'Frånvaro');
		if (entry.status === 'Open') {
			parts.push('Pågående');
		}
		if (entry.approved) {
			parts.push('Godkänd');
		}
		return parts.join(' · ');
	}

	function normalizeText(value: string) {
		return value.trim().toLocaleLowerCase();
	}

	function bucketMinutes(
		values: SalaryReportDetail[],
		extractor: (item: SalaryReportDetail) => number
	) {
		return values.reduce((acc, item) => acc + extractor(item), 0);
	}

	$: detailBuckets = trainer
		? [
				{
					key: 'weekday',
					label: 'Vardagar',
					entries: trainer.weekday,
					minutes: bucketMinutes(trainer.weekday, (item) => item.durationMinutes)
				},
				{
					key: 'ob',
					label: 'OB',
					entries: trainer.ob,
					minutes: bucketMinutes(trainer.ob, (item) => item.obMinutes ?? item.durationMinutes)
				},
				{
					key: 'weekend',
					label: 'Helg',
					entries: trainer.weekend,
					minutes: bucketMinutes(trainer.weekend, (item) => item.durationMinutes)
				},
				{
					key: 'holiday',
					label: 'Helgdag',
					entries: trainer.holiday,
					minutes: bucketMinutes(trainer.holiday, (item) => item.durationMinutes)
				},
				{
					key: 'education',
					label: 'Utbildning',
					entries: trainer.education,
					minutes: bucketMinutes(trainer.education, (item) => item.durationMinutes)
				},
				{
					key: 'tryOut',
					label: 'Prova-på',
					entries: trainer.tryOut,
					minutes: bucketMinutes(trainer.tryOut, (item) => item.durationMinutes)
				},
				{
					key: 'internal',
					label: 'Interna',
					entries: trainer.internal,
					minutes: bucketMinutes(trainer.internal, (item) => item.durationMinutes)
				}
			]
		: [];
</script>

{#if trainer}
	<div class="space-y-6">
		<div>
			<p class="text-text text-xl font-semibold">{trainer.name}</p>
			<p class="text-text/70 text-sm">
				{trainer.email ?? 'Ingen e-post'} · {trainer.locationName ?? 'Ingen plats'}
			</p>
			{#if trainer.absenceDays > 0}
				<p class="text-text/70 text-sm">
					Frånvaro under perioden: {formatDayLabel(trainer.absenceDays)}
				</p>
			{/if}
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			{#each detailBuckets as bucket}
				<details class="rounded-sm border border-gray-200 p-3">
					<summary class="cursor-pointer font-semibold">
						{bucket.label} ({bucket.entries.length} st, {minutesToHours(bucket.minutes).toFixed(2)} h)
					</summary>
					{#if bucket.entries.length === 0}
						<p class="text-text/60 mt-2 text-sm">Ingen data.</p>
					{:else}
						<ul class="mt-2 space-y-2 text-sm">
							{#each bucket.entries as entry}
								<li class="rounded-sm bg-gray-50 p-2">
									<p class="font-medium">
										{formatDateTime(entry.startTime)} – {formatDateTime(entry.endTime)}
									</p>
									<p class="text-text/70">
										{minutesToHours(
											bucket.key === 'ob'
												? (entry.obMinutes ?? entry.durationMinutes)
												: entry.durationMinutes
										).toFixed(2)}
										h ({entry.durationMinutes} min)
									</p>
									<p class="text-text/70">
										{entry.clientName ?? 'Okänd klient'}
										{#if entry.customerName}
											· {entry.customerName}
										{/if}
										{#if entry.bookingType}
											· {entry.bookingType}
										{/if}
										{#if entry.locationName}
											· {entry.locationName}
										{/if}
									</p>
								</li>
							{/each}
						</ul>
					{/if}
				</details>
			{/each}
		</div>

		<div>
			<h3 class="text-text text-lg font-semibold">Extra uppdrag</h3>
			{#if trainer.extraDuties.length === 0}
				<p class="text-text/70 text-sm">Inga extra uppdrag registrerade.</p>
			{:else}
				<ul class="mt-2 space-y-2 text-sm">
					{#each trainer.extraDuties as duty}
						<li class="rounded-sm border border-gray-200 p-2">
							<p class="font-medium">{duty.name}</p>
							<p class="text-text/70">
								Status: {duty.approved ? 'Godkänd' : 'Avvaktande'}
								{#if duty.note}
									· {duty.note}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div>
			<h3 class="text-text text-lg font-semibold">Frånvaro</h3>
			{#if trainer.absences.length === 0}
				<p class="text-text/70 text-sm">Ingen frånvaro registrerad för perioden.</p>
			{:else}
				<div class="mt-2 space-y-3">
					{#each trainer.absences as group}
						<details class="rounded-sm border border-gray-200 p-3">
							<summary class="cursor-pointer font-semibold">
								{group.label} ({group.count} st, {formatDayLabel(group.days)})
							</summary>
							<ul class="mt-2 space-y-2 text-sm">
								{#each group.entries as entry}
									<li class="rounded-sm bg-gray-50 p-2">
										<p class="font-medium">{formatDateRange(entry)}</p>
										<p class="text-text/70">{formatDayLabel(entry.days)}</p>
										<p class="text-text/60">{formatAbsenceMeta(entry)}</p>
										{#if entry.description && normalizeText(entry.description) !== normalizeText(group.label)}
											<p class="text-text/70">{entry.description}</p>
										{/if}
									</li>
								{/each}
							</ul>
						</details>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<p class="text-text/70 text-sm">Ingen tränare vald.</p>
{/if}
