export function debounce(callback, delay = 300) {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => callback(...args), delay);
	};
}
