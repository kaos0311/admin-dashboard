import type { ChangeEvent } from "react";
import { forms, typography } from "@/theme";

type FieldProps = {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "url" | "number" | "password";
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
        <span
          className={`text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}
        >
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
          className={`${forms.textarea} mt-2`}
        />
      </label>
    );
  }

  return (
    <label className="block" htmlFor={id}>
      <span
        className={`text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}
      >
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
        className={`${forms.input} mt-2`}
      />
    </label>
  );
}



