<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import QuillEditor from '../../bits/quillEditor/QuillEditor.svelte';
	import NewsPublishOptions from './NewsPublishOptions.svelte';
	import NewsVisibilitySelector from './NewsVisibilitySelector.svelte';
	import { ROLE_OPTIONS, roleLabel } from '$lib/constants/roles';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { invalidateByPrefix } from '$lib/services/api/apiCache';
	import type { NewsItem } from '$lib/types/newsTypes';

	type Props = {
		news?: NewsItem | null;
		mode?: 'create' | 'edit';
		showSendEmail?: boolean;
		cancelHref?: string;
		onSaved?: (news: NewsItem) => void;
	};

	let {
		news = null,
		mode = 'create',
		showSendEmail = false,
		cancelHref = '/news',
		onSaved
	}: Props = $props();

	const roleOptions = [
		...ROLE_OPTIONS,
		{ name: 'Platschef', value: 'LocationManager' },
		{ name: 'Bokföring', value: 'BookKeepingAdmin' },
		{ name: 'Eventadmin', value: 'EventAdmin' }
	];

	let title = $state(news?.title ?? '');
	let text = $state(news?.text ?? '');
	let selectedRoles = $state<string[]>(news?.roles ?? []);
	let pinned = $state(Boolean(news?.pinned));
	let sendEmail = $state(false);
	let isSubmitting = $state(false);
	let currentNewsId = $state<number | null>(news?.id ?? null);

	$effect(() => {
		const nextNewsId = news?.id ?? null;
		if (nextNewsId !== currentNewsId) {
			currentNewsId = nextNewsId;
			title = news?.title ?? '';
			text = news?.text ?? '';
			selectedRoles = news?.roles ?? [];
			pinned = Boolean(news?.pinned);
			sendEmail = false;
		}
	});

	let selectedRoleSummary = $derived(
		selectedRoles.length === 0
			? 'Alla med en roll'
			: selectedRoles.map((role) => roleLabel(role)).join(', ')
	);

	let formTitle = $derived(mode === 'create' ? 'Skapa nyhet' : 'Redigera nyhet');
	let formDescription = $derived(
		mode === 'create'
			? 'Publicera intern information till tränare.'
			: 'Uppdatera innehåll och synlighet.'
	);
	let submitText = $derived(
		isSubmitting ? 'Sparar...' : mode === 'create' ? 'Publicera nyhet' : 'Spara ändringar'
	);

	function isEmptyContent(value: string): boolean {
		if (!value) return true;
		const cleaned = value
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		return cleaned.length === 0;
	}

	async function handleSubmit() {
		if (!title.trim() || isEmptyContent(text)) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Titel och text krävs',
				description: ''
			});
			return;
		}

		isSubmitting = true;
		try {
			const payload: Record<string, unknown> = {
				title: title.trim(),
				text,
				roles: selectedRoles,
				pinned
			};
			if (mode === 'create') {
				payload.sendEmail = sendEmail;
			}
			const endpoint = mode === 'create' ? '/api/news' : `/api/news/${news?.id}`;
			const method = mode === 'create' ? 'POST' : 'PUT';

			const res = await fetch(endpoint, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const msg = await res.text();
				throw new Error(msg || 'Kunde inte spara nyheten');
			}

			const data = await res.json();
			const savedNews: NewsItem = data.news ?? data;
			invalidateByPrefix('/api/news');

			addToast({
				type: AppToastType.SUCCESS,
				message: mode === 'create' ? 'Nyhet skapad' : 'Nyhet uppdaterad',
				description: ''
			});

			onSaved?.(savedNews);

			if (mode === 'create') {
				title = '';
				text = '';
				selectedRoles = [];
				pinned = false;
				sendEmail = false;
			}
		} catch (err: any) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte spara',
				description: err?.message ?? 'Okänt fel'
			});
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-sm border border-gray-200 bg-white p-5 shadow-sm">
		<div class="mb-5 flex items-start justify-between gap-4">
			<div>
				<h3 class="text-text text-xl font-semibold">{formTitle}</h3>
				<p class="mt-1 text-sm text-gray-500">{formDescription}</p>
			</div>
			<a
				href={cancelHref}
				class="inline-flex h-8 items-center gap-2 rounded-sm border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
			>
				<Icon icon="ChevronLeft" size="14px" />
				Tillbaka
			</a>
		</div>

		<div class="mb-4">
			<label for="news-title" class="mb-3 block text-sm font-medium">Titel</label>
			<input
				id="news-title"
				name="title"
				placeholder="Rubrik"
				bind:value={title}
				class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-black transition-colors duration-150 focus:border-gray-500 focus:outline-hidden"
			/>
		</div>

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
			<NewsVisibilitySelector
				options={roleOptions}
				{selectedRoles}
				summary={selectedRoleSummary}
				onChange={(roles) => (selectedRoles = roles)}
			/>

			<NewsPublishOptions
				{pinned}
				{sendEmail}
				{showSendEmail}
				onPinnedChange={(value) => (pinned = value)}
				onSendEmailChange={(value) => (sendEmail = value)}
			/>
		</div>
	</div>

	<div class="rounded-sm border border-gray-200 bg-white p-5 shadow-sm">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h4 class="text-text text-sm font-semibold">Innehåll</h4>
				<p class="mt-1 text-xs text-gray-500">
					Texten visas i artikelvyn och i mailet om det skickas.
				</p>
			</div>
			<Icon icon="Edit" size="18px" extraClasses="text-gray-400" />
		</div>
		<QuillEditor
			content={text}
			placeholder="Skriv nyhetsinnehållet här..."
			onChange={(value) => (text = value)}
		/>
	</div>

	<div class="flex justify-end gap-2">
		<button
			type="button"
			class="border-gray text-gray inline-flex h-[45px] items-center gap-2 rounded-sm border bg-white px-4 text-base font-semibold shadow-xs transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
			onclick={() => goto(cancelHref)}
			disabled={isSubmitting}
		>
			<Icon icon="ChevronLeft" size="14px" />
			Avbryt
		</button>
		<button
			type="button"
			class="border-gray/30 bg-primary hover:bg-primary-hover inline-flex h-[45px] items-center gap-2 rounded-sm border px-4 text-base font-semibold text-white shadow-xs transition disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
			onclick={handleSubmit}
			disabled={isSubmitting}
		>
			<Icon icon="Save" size="14px" />
			{submitText}
		</button>
	</div>
</div>
