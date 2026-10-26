export type ComboBom = {
	materialPackagingId: number;
	quantity: number;
	unit?: string;
};

export const comboBoms = (boms?: ComboBom[] | null): ComboBom[] =>
	(boms ?? []).filter(
		item =>
			Number(item.materialPackagingId) > 0 && Number(item.quantity) > 0,
	);

export const isComboPackaging = (
	category?: string | null,
	boms?: ComboBom[] | null,
) => String(category || "").toUpperCase() === "SERVICE" && comboBoms(boms).length > 0;

export const comboOptionLabel = (name: string) => `${name} (Combo)`;
