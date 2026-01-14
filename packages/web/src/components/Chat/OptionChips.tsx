interface Option {
  label: string
  description?: string
}

interface OptionChipsProps {
  options: Option[]
  selectedIndex?: number
  onSelect: (index: number) => void
  disabled?: boolean
}

export function OptionChips({ options, selectedIndex, onSelect, disabled = false }: OptionChipsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2)',
        marginTop: 'var(--space-3)',
      }}
    >
      {options.map((option, index) => {
        const isSelected = selectedIndex === index
        return (
          <button
            key={index}
            onClick={() => !disabled && onSelect(index)}
            disabled={disabled}
            title={option.description}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              backgroundColor: isSelected ? 'var(--accent-primary-muted)' : 'transparent',
              color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'var(--transition-fast)',
              opacity: disabled && !isSelected ? 0.5 : 1,
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
