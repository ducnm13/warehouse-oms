import React, { useState } from "react";
import {
	Calendar,
	ChevronDown,
	Eye,
	EyeOff,
	Search,
	UploadCloud,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const inputClass =
	"h-11 w-full rounded-lg border border-[#d0d5dd] bg-white px-4 text-sm text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.05)] outline-none transition placeholder:text-[#98a2b3] hover:border-[#98a2b3] focus:border-[#465fff] focus:ring-4 focus:ring-[#465fff]/10 disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]";

export const inputErrorClass =
	"border-[#f04438] focus:border-[#f04438] focus:ring-[#f04438]/10";
export const inputSuccessClass =
	"border-[#12b76a] focus:border-[#12b76a] focus:ring-[#12b76a]/10";

export function Field({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("space-y-1.5", className)} {...props}>
			{children}
		</div>
	);
}

export function FieldLabel({
	className,
	required,
	children,
	...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
	return (
		<label
			className={cn("block text-sm font-medium text-[#344054]", className)}
			{...props}
		>
			{children}
			{/* {required && <span className="ml-1 text-[#f04438]">*</span>} */}
		</label>
	);
}

export function FieldHint({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return <p className={cn("text-xs text-[#667085]", className)} {...props} />;
}

export function FieldError({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("text-xs font-medium text-[#d92d20]", className)}
			{...props}
		/>
	);
}

export function Input({
	className,
	...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
	return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({
	className,
	children,
	...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<div className="relative">
			<select
				className={cn(
					inputClass,
					"cursor-pointer appearance-none pr-10",
					className,
				)}
				{...props}
			>
				{children}
			</select>
			<ChevronDown
				size={16}
				className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#667085]"
			/>
		</div>
	);
}

export function Textarea({
	className,
	...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(inputClass, "h-auto min-h-[96px] py-3", className)}
			{...props}
		/>
	);
}

export function SearchInput({
	className,
	...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
	return (
		<div className="relative">
			<Search
				size={17}
				className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a2b3]"
			/>
			<input className={cn(inputClass, "pl-10", className)} {...props} />
		</div>
	);
}

export function InputGroup({
	className,
	prefix,
	suffix,
	children,
	...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
	prefix?: React.ReactNode;
	suffix?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex overflow-hidden rounded-lg border border-[#d0d5dd] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition focus-within:border-[#465fff] focus-within:ring-4 focus-within:ring-[#465fff]/10",
				className,
			)}
		>
			{prefix && (
				<span className="flex items-center gap-1 border-r border-[#eaecf0] bg-[#f9fafb] px-3 text-sm font-medium text-[#667085]">
					{prefix}
				</span>
			)}
			<input
				className="h-11 w-full bg-transparent px-4 text-sm text-[#101828] outline-none placeholder:text-[#98a2b3]"
				{...props}
			>
				{children}
			</input>
			{suffix && (
				<span className="flex items-center gap-1 border-l border-[#eaecf0] bg-[#f9fafb] px-3 text-sm font-medium text-[#667085]">
					{suffix}
				</span>
			)}
		</div>
	);
}

export function PasswordInput({
	className,
	icon,
	...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) {
	const [show, setShow] = useState(false);
	return (
		<div className="relative">
			{icon && (
				<span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a2b3]">
					{icon}
				</span>
			)}
			<input
				type={show ? "text" : "password"}
				className={cn(
					inputClass,
					icon ? "pl-10" : undefined,
					"pr-11",
					className,
				)}
				{...props}
			/>
			<button
				type="button"
				onClick={() => setShow(current => !current)}
				className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#98a2b3] hover:bg-[#f2f4f7] hover:text-[#344054]"
				title={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
			>
				{show ? <EyeOff size={17} /> : <Eye size={17} />}
			</button>
		</div>
	);
}

export function DateInput({
	className,
	...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
	return (
		<div className="relative">
			<input
				type="date"
				className={cn(inputClass, "pr-10", className)}
				{...props}
			/>
			<Calendar
				size={17}
				className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#98a2b3]"
			/>
		</div>
	);
}

export function FileInput({
	className,
	accept = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg",
	hint = "Kéo thả hoặc bấm để chọn tệp",
	...props
}: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string }) {
	return (
		<label
			className={cn(
				"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#d0d5dd] bg-[#fcfcfd] px-6 py-8 text-center transition hover:border-[#465fff] hover:bg-[#ecf3ff]/40",
				className,
			)}
		>
			<span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ecf3ff] text-[#465fff]">
				<UploadCloud size={20} />
			</span>
			<span className="text-sm font-medium text-[#344054]">{hint}</span>
			<span className="text-xs text-[#98a2b3]">{accept}</span>
			<input type="file" accept={accept} className="hidden" {...props} />
		</label>
	);
}

export function Checkbox({
	className,
	label,
	...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#344054]">
			<input
				type="checkbox"
				className={cn(
					"h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border border-[#d0d5dd] bg-white transition checked:border-[#465fff] checked:bg-[#465fff] checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27none%27><path d=%27M13.5 6.5 8.75 11.25 6.5 9%27 stroke=%27white%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/></svg>')] checked:bg-center checked:bg-no-repeat disabled:cursor-not-allowed disabled:bg-[#f2f4f7]",
					className,
				)}
				{...props}
			/>
			{label}
		</label>
	);
}

export function Radio({
	className,
	label,
	...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#344054]">
			<input
				type="radio"
				className={cn(
					"h-[18px] w-[18px] cursor-pointer appearance-none rounded-full border border-[#d0d5dd] bg-white transition checked:border-[5px] checked:border-[#465fff] disabled:cursor-not-allowed disabled:bg-[#f2f4f7]",
					className,
				)}
				{...props}
			/>
			{label}
		</label>
	);
}

export function Toggle({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
	label?: React.ReactNode;
}) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#344054]">
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={cn(
					"relative h-6 w-11 rounded-full transition-colors",
					checked ? "bg-[#465fff]" : "bg-[#eaecf0]",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
						checked ? "left-[22px]" : "left-0.5",
					)}
				/>
			</button>
			{label}
		</label>
	);
}
