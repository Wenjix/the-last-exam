import { useCallback } from 'react';

/** Supported commentary languages — mirrors @tle/audio CommentaryLanguage. */
type CommentaryLanguage = 'en' | 'fr' | 'ja';

const LANGUAGE_OPTIONS: readonly { value: CommentaryLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Fran\u00e7ais' },
  { value: 'ja', label: '\u65e5\u672c\u8a9e' },
];

interface LanguageSelectorProps {
  /** Currently selected language. */
  value: CommentaryLanguage;
  /** Callback fired when the user picks a different language. */
  onChange: (language: CommentaryLanguage) => void;
  /** If true, the selector is disabled. */
  disabled?: boolean;
}

/**
 * Dropdown selector for live commentary language.
 *
 * UI labels remain in English; only the live commentary output
 * changes language.
 */
export function LanguageSelector({ value, onChange, disabled = false }: LanguageSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as CommentaryLanguage);
    },
    [onChange],
  );

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <label htmlFor="commentary-language" style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
        Commentary Language
      </label>
      <select
        id="commentary-language"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.875rem',
          borderRadius: '4px',
          border: '1px solid #ccc',
          backgroundColor: disabled ? '#f5f5f5' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
