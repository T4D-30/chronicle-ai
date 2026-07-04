import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs))

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  /** Placeholder shown as a disabled first option when no value is selected. */
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, options, placeholder, value, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="stat-label text-void-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          value={value}
          className={cn(
            'w-full px-3 py-2 rounded-md',
            'bg-void-900 border',
            'text-white',
            'text-sm font-body',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-arcane-400 focus:border-transparent',
            error
              ? 'border-harm-600 focus:ring-harm-400'
              : 'border-void-700 hover:border-void-600',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden={value !== '' && value !== undefined}>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && <p className="text-xs text-void-500">{hint}</p>}
        {error && <p className="text-xs text-harm-400">{error}</p>}
      </div>
    )
  },
)

Select.displayName = 'Select'
