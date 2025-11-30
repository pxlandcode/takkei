class HeaderState {
	title = $state('');
	icon = $state<string | null>(null);
}

export const headerState = new HeaderState();
