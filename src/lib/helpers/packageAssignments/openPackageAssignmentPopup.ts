import PackageAssignmentPopup from '../../../components/ui/packageAssignmentPopup/PackageAssignmentPopup.svelte';
import { openPopup } from '$lib/stores/popupStore';

export type PackageAssignmentPopupOptions = {
	scope: 'client' | 'customer';
	scopeId: number;
	preselectedPackageId?: number | null;
	initialFilter?: 'all' | 'linked' | 'missing';
	onApplied?: (detail?: unknown) => void;
};

export function openPackageAssignmentPopup({
	scope,
	scopeId,
	preselectedPackageId = null,
	initialFilter = 'all',
	onApplied
}: PackageAssignmentPopupOptions) {
	openPopup({
		header: 'Hantera paketbokningar',
		icon: 'Package',
		component: PackageAssignmentPopup,
		width: '1200px',
		height: '85vh',
		maxWidth: '96vw',
		maxHeight: '90vh',
		variant: 'modal',
		draggable: false,
		minimizable: false,
		props: {
			scope,
			scopeId,
			preselectedPackageId,
			initialFilter
		},
		listeners: onApplied
			? {
				applied: (event) => onApplied(event.detail)
			}
			: undefined
	});
}
