import { useCallback } from 'react';

type CommentaryLanguage = 'en' | 'fr' | 'ja';

const LANGUAGE_OPTIONS: readonly { value: CommentaryLanguage; label: string }[] = [
  { value: 'en', label: 'en' },
  { value: 'fr', label: 'fr' },
  { value: 'ja', label: 'ja' },
];

interface LanguageSelectorProps {
  value: CommentaryLanguage;
  onChange: (language: CommentaryLanguage) => void;
  disabled?: boolean;
}

export function LanguageSelector({ value, onChange, disabled = false }: LanguageSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as CommentaryLanguage);
    },
    [onChange],
  );

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className="glass-select"
      aria-label="commentary language"
    >
      {LANGUAGE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
