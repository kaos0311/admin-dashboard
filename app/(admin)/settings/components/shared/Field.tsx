import type { ChangeEvent } from "react";
import { glassInput, glassTextarea } from "../../styles/glass";

type FieldProps = {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "url" | "number";
  placeholder?: string;
  textarea?: boolean;
};

export function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  textarea = false,
}: FieldProps) {
  if (textarea) {
    return (
      <label className="block" htmlFor={id}>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>

        <textarea
          id={id}
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          rows={4}
          className={`${glassTextarea} mt-2`}
        />
      </label>
    );
  }

  return (
    <label className="block" htmlFor={id}>
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>

      <input
        id={id}
        type={type}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className={`${glassInput} mt-2`}
      />
    </label>
  );
}