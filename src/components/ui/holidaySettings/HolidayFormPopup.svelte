<script lang="ts">
        import Input from '../../bits/Input/Input.svelte';
        import TextArea from '../../bits/textarea/TextArea.svelte';
        import Button from '../../bits/button/Button.svelte';
        import { closePopup } from '$lib/stores/popupStore';
        import {
                createHoliday,
                updateHoliday,
                type HolidayServiceError
        } from '$lib/services/api/holidayService';
        import type { Holiday, HolidayPayload } from '$lib/types/holiday';

        export let holiday: Holiday | null = null;
        export let onSaved: (holiday: Holiday) => void = () => {};

        let name = holiday?.name ?? '';
        let date = holiday?.date ?? '';
        let description = holiday?.description ?? '';
        let saving = false;
        let validationErrors: Record<string, string> = {};
        let generalError: string | null = null;

        function resetErrors() {
                validationErrors = {};
                generalError = null;
        }

        async function handleSubmit(event: Event) {
                event.preventDefault();
                resetErrors();

                const payload: HolidayPayload = {
                        name: name.trim(),
                        date: date.trim(),
                        description: description.trim() ? description.trim() : undefined
                };

                if (!payload.name) {
                        validationErrors.name = 'Namn krävs';
                }
                if (!payload.date) {
                        validationErrors.date = 'Datum krävs';
                }
                if (Object.keys(validationErrors).length > 0) {
                        generalError = 'Kontrollera formuläret.';
                        return;
                }

                saving = true;
                try {
                        const saved = holiday
                                ? await updateHoliday(holiday.id, payload)
                                : await createHoliday(payload);

                        onSaved?.(saved);
                        closePopup();
                } catch (error) {
                        console.error('Failed to save holiday', error);
                        const apiError = error as HolidayServiceError;
                        if (apiError?.errors) {
                                validationErrors = apiError.errors;
                        }
                        generalError = apiError?.message ?? 'Kunde inte spara helgdag.';
                } finally {
                        saving = false;
                }
        }

        function handleCancel() {
                closePopup();
        }
</script>

<form class="space-y-4" on:submit|preventDefault={handleSubmit}>
        {#if generalError}
                <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">{generalError}</div>
        {/if}

        <Input label="Namn" name="holiday-name" bind:value={name} errors={validationErrors} />

        <Input
                label="Datum"
                name="holiday-date"
                type="date"
                bind:value={date}
                errors={validationErrors}
        />

        <TextArea
                label="Beskrivning"
                name="holiday-description"
                bind:value={description}
                errors={validationErrors}
        />

        <div class="flex justify-end gap-2 pt-2">
                <Button
                        type="submit"
                        text={holiday ? 'Spara ändringar' : 'Lägg till helgdag'}
                        variant="primary"
                        disabled={saving}
                />
                <Button text="Avbryt" variant="secondary" on:click={handleCancel} disabled={saving} />
        </div>
</form>
