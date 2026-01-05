<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import QuillEditor from '../../bits/quillEditor/QuillEditor.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { NewsItem } from '$lib/types/newsTypes';

	export let news: NewsItem | null = null;
	export let mode: 'create' | 'edit' = 'create';
	export let showSendEmail = false;

	const dispatch = createEventDispatcher();

	const roleOptions = [
		'Administrator',
		'LocationManager',
		'LocationAdmin',
		'BookKeepingAdmin',
		'Economy',
		'Trainer',
		'Educator',
		'EventAdmin'
	];

	let title = news?.title ?? '';
	let text = news?.text ?? '';
	let selectedRoles: string[] = news?.roles ?? [];
	let sendEmail = false;
	let isSubmitting = false;

	$: if (news) {
		title = news.title;
		text = news.text;
		selectedRoles = news.roles ?? [];
	}

	function isEmptyContent(value: string): boolean {
		if (!value) return true;
		const cleaned = value
			.replace(/<[^>]*>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		return cleaned.length === 0;
	}

	function toggleRole(role: string) {
		selectedRoles = selectedRoles.includes(role)
			? selectedRoles.filter((r) => r !== role)
			: [...selectedRoles, role];
	}

	async function handleSubmit() {
		if (!title.trim() || isEmptyContent(text)) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Titel och text krävs'
			});
			return;
		}

		isSubmitting = true;
		try {
			const payload: Record<string, unknown> = {
				title: title.trim(),
				text,
				roles: selectedRoles
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

			addToast({
				type: AppToastType.SUCCESS,
				message: mode === 'create' ? 'Nyhet skapad' : 'Nyhet uppdaterad'
			});

			dispatch('saved', { news: savedNews });

			if (mode === 'create') {
				title = '';
				text = '';
				selectedRoles = [];
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

<div class="flex flex-col gap-3">
	<Input label="Titel" name="title" bind:value={title} />

	<div>
		<p class="mb-2 text-sm font-semibold text-gray-700">Synlig för roller</p>
		<div class="grid grid-cols-2 gap-2 md:grid-cols-3">
			{#each roleOptions as role}
				<Checkbox
					id={role}
					label={role}
					checked={selectedRoles.includes(role)}
					on:change={() => toggleRole(role)}
				/>
			{/each}
		</div>
		<p class="mt-1 text-xs text-gray-500">
			Om inga roller väljs visas nyheten för alla med en roll.
		</p>
	</div>

	<div>
		<p class="mb-2 text-sm font-semibold text-gray-700">Innehåll</p>
		<QuillEditor content={text} placeholder="Skriv nyhetsinnehållet här..." on:change={(e) => (text = e.detail ?? '')} />
	</div>

	{#if showSendEmail}
		<div class="flex items-center gap-2">
			<Checkbox id="send-email" bind:checked={sendEmail} label="Skicka som mail" />
			<span class="text-xs text-gray-500">(mottagare filtreras på valda roller)</span>
		</div>
	{/if}

	<div class="flex justify-end gap-2">
		<Button
			variant="primary"
			iconLeft="Save"
			text={mode === 'create' ? 'Publicera nyhet' : 'Spara ändringar'}
			on:click={handleSubmit}
			disabled={isSubmitting}
		/>
	</div>
</div>
