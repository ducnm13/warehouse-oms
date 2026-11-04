import { useMemo, useState } from "react";
import { currentMonthKey, monthRange } from "../lib/utils";

export function useMonthFilter() {
	const [month, setMonth] = useState(currentMonthKey());
	const range = useMemo(() => monthRange(month), [month]);
	return { month, setMonth, range };
}
