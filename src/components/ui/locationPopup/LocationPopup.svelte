<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import ColorPicker from '../../bits/colorPicker/ColorPicker.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import { nanoid } from 'nanoid';

	export let location = {
		id: null,
		name: '',
		color: '#cccccc',
		rooms: []
	};
	export let onSave: (locationData) => void;

	let name = location.name;
	let color = location.color;
	let rooms = location.rooms.map((room) => ({ ...room })); // clone
	let isEditingRooms = false;

	let exampleTrainer = { firstname: 'Alex', lastname: 'Berg' };

	function save() {
		onSave({ id: location.id, name, color, rooms });
	}

	function addRoom() {
		rooms = [
			...rooms,
			{
				id: `new-${nanoid(6)}`,
				name: 'Tränings rum ' + (rooms.length + 1),
				active: true
			}
		];
	}

	function toggleRoomActive(index) {
		rooms = rooms.map((room, i) => (i === index ? { ...room, active: !room.active } : room));
	}
</script>

<div class="w-full min-w-0 space-y-6 sm:min-w-[20rem]">
	<!-- 🏷 Name -->
	<Input bind:value={name} name="locationName" label="Namn" placeholder="Lokalens namn" />

	<!-- 🎨 Color -->
	<ColorPicker bind:value={color} />

	<!-- 🏠 Rooms -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<label class="text-sm font-medium">Rum</label>
			<div class="flex gap-2">
				<Button small text="Lägg till rum" iconLeft="Plus" on:click={addRoom} />
				<Button
					small
					icon="Edit"
					variant="secondary"
					on:click={() => (isEditingRooms = !isEditingRooms)}
				/>
			</div>
		</div>

		<div class="space-y-2">
			{#each rooms as room, i}
				<div
					class="relative flex flex-col gap-3 rounded-sm border px-3 py-2 transition-opacity sm:flex-row sm:items-center sm:justify-between"
					class:opacity-50={!room.active}
				>
					{#if !room.active}
						<div class="cancelled-overlay"></div>
					{/if}

					<Input
						class="w-full"
						name={`room-${i}`}
						placeholder="Rumnamn"
						bind:value={room.name}
						disabled={!isEditingRooms}
					/>

					<div class="flex items-center gap-2 sm:ml-2">
						<label class="text-sm text-gray-600">Aktiv</label>
						<input
							type="checkbox"
							checked={room.active}
							disabled={!isEditingRooms}
							on:change={() => toggleRoomActive(i)}
							class="h-4 w-4"
						/>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- 🔍 Preview -->
	<div>
		<label class="mb-1 block text-sm">Förhandsvisning</label>
		<div
			class="w-full max-w-xs rounded-md border p-2 text-xs text-gray-700 shadow-xs"
			style="background-color: {color}20; border-color: {color}; color: {color};"
		>
			<div class="flex flex-row gap-2">
				<Icon icon="Gymnastics" size="20px" />
				<div class="mb-1 font-semibold">Gymnastik</div>
			</div>
			<div class="text-xs">10:00 - 11:00</div>
			<div class="mt-1 text-xs">
				{exampleTrainer.firstname}
				{exampleTrainer.lastname}
			</div>
			<div class="text-xs">{name}</div>
		</div>
	</div>

	<!-- 💾 Save -->
	<div class="mt-4 flex justify-end">
		<Button on:click={save} text="Spara" iconRight="Save" iconRightSize="18px" />
	</div>
</div>

<style>
	.cancelled-overlay {
		position: absolute;
		inset: 0;
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(0, 0, 0, 0.05) 0px,
			rgba(0, 0, 0, 0.05) 5px,
			transparent 5px,
			transparent 10px
		);
		pointer-events: none;
		border-radius: 6px;
	}
</style>
