<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
	import { achievementStore, updateAchievements } from '$lib/stores/achievementsStore';
	import { onMount } from 'svelte';

	export let userId: number;

	// Fetch achievements when component mounts
	onMount(() => {
		const today = new Date().toISOString().slice(0, 10);
		updateAchievements(userId, today);
	});
</script>

<div class="achievements-container">
	<h3 class="text-lg font-semibold text-gray-800">Utmärkelser</h3>

	{#if $achievementStore.length > 0}
		<div class="badge-grid">
			{#each $achievementStore as achievement}
				<div
					use:tooltip={{ content: achievement?.description }}
					class="achievement-wrapper flex flex-col items-center gap-4 text-center"
				>
					<div class="achievement-badge">
						<!-- Emoji inside the circular badge -->
						<span class="badge-emoji">🏆</span>

						<!-- Counter bubble in bottom-right corner -->
						<span class="badge-count">x{achievement.achieved}</span>
					</div>
					<p class="achievement-title">{achievement.title}</p>
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-sm text-gray-500">Inga utmärkelser ännu.</p>
	{/if}
</div>

<style>
	/* 🎖️ Container */
	.achievement-wrapper {
		/* background: linear-gradient(145deg, #ffd700, #ffac33); */
		padding: 10px;
		border-radius: 12px;
		display: inline-block;
		/* box-shadow: 0px 4px 12px rgba(255, 215, 0, 0.5); */
	}

	/* 🏅 Circular Achievement Badges */
	.achievement-badge {
		position: relative;
		margin: 0 auto;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: linear-gradient(145deg, #ffd700, #ffac33);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28px;
		box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
		transition: transform 0.2s ease-in-out;
		cursor: default;
	}

	.achievement-badge:hover {
		transform: scale(1.05);
		background: linear-gradient(155deg, #fbdd30, #ffac33);
	}

	/* 🎨 Emoji inside badge */
	.badge-emoji {
		font-size: 32px;
	}

	/* 🔢 Counter bubble */
	.badge-count {
		position: absolute;
		bottom: -4px;
		right: -4px;
		background: #ffac33;
		color: white;
		font-size: 12px;
		font-weight: bold;
		padding: 4px 8px;
		border-radius: 50%;
		box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.2);
	}

	/* ✨ Achievement Title */
	.achievement-title {
		font-size: 14px;
		font-weight: bold;
		color: #333;
		margin-top: 10px;
	}
</style>
