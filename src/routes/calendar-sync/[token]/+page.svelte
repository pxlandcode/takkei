<script lang="ts">
	import Button from '../../../components/bits/button/Button.svelte';

	export let data: {
		feedUrl: string;
		webcalUrl: string;
		syncPageUrl: string;
		bookingsPageUrl: string;
	};

	let copied = false;

	async function copyFeedUrl() {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return;
		await navigator.clipboard.writeText(data.feedUrl);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 1800);
	}

	function openAppleCalendar() {
		window.location.assign(data.webcalUrl);
	}

	function openGoogleCalendar() {
		window.open('https://calendar.google.com/calendar/r/settings/addbyurl', '_blank', 'noreferrer');
	}

	function openBookings() {
		window.location.assign(data.bookingsPageUrl);
	}
</script>

<svelte:head>
	<title>Prenumerera i din kalender | Takkei</title>
</svelte:head>

<main class="min-h-full bg-white text-text">
	<section class="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-8 px-6 py-12">
		<div class="space-y-3">
			<img src="/images/takkei-logo.png" alt="Takkei" class="h-14 w-auto" />
			<h1 class="text-3xl font-semibold">Prenumerera i din kalender</h1>
			<p class="text-sm leading-6 text-gray">
				Lägg till Takkei som en prenumererad kalender. När dina bokningar ändras uppdateras
				kalendern automatiskt nästa gång din kalenderapp hämtar nya data.
			</p>
		</div>

		<div class="grid gap-3">
			<Button
				text="Prenumerera i din kalender"
				iconLeft="CalendarCheck"
				iconLeftSize="16px"
				variant="primary"
				full
				on:click={openAppleCalendar}
			/>

			<Button
				text="Öppna Google Kalender"
				iconLeft="Calendar"
				iconLeftSize="16px"
				variant="secondary"
				full
				on:click={openGoogleCalendar}
			/>

			<Button
				text={copied ? 'Länk kopierad' : 'Kopiera kalenderlänk'}
				iconLeft={copied ? 'CircleCheck' : 'Save'}
				iconLeftSize="16px"
				variant="secondary"
				full
				on:click={copyFeedUrl}
			/>

			<Button
				text="Se alla dina bokningar"
				iconLeft="CalendarMy"
				iconLeftSize="16px"
				variant="secondary"
				full
				on:click={openBookings}
			/>
		</div>

		<p class="text-xs leading-5 text-gray">
			Google Kalender kräver normalt att kalendern läggs till via webbläsare på dator:
			Inställningar, Lägg till kalender, Från webbadress.
		</p>
	</section>
</main>
