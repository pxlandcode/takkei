export function clickOutside(node: HTMLElement, callback: () => void) {
	// Function to check if click is outside the element
	const handleClick = (event: MouseEvent) => {
		// Ensure target is a valid node
		if (!event.target) return;

		// Check if click is inside the node
		if (node.contains(event.target as Node)) return;

		// Run the callback if click is outside
		callback();
	};

	// Delay adding event listener to prevent immediate close when toggling
	setTimeout(() => {
		document.addEventListener('click', handleClick);
	});

	// Cleanup function (Svelte runs this when the element is removed)
	return {
		destroy() {
			document.removeEventListener('click', handleClick);
		}
	};
}
