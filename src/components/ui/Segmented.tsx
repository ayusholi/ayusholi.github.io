"use client";

// A small group of mutually exclusive choices.
type Props<V extends string> = {
  id?: string;
  label?: string;
  value: V;
  options: readonly (readonly [V, string])[];
  onChange: (value: V) => void;
};

export const Segmented = <V extends string>({ id, label, value, options, onChange }: Props<V>) => (
  <div className="seg" id={id} role="group" aria-label={label}>
    {options.map(([v, text]) => (
      <button key={v} type="button" data-value={v} aria-pressed={v === value} onClick={() => onChange(v)}>{text}</button>
    ))}
  </div>
);
