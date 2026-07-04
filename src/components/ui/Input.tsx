import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs))

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:    string
  error?:    string
  hint?:     string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="stat-label text-void-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 rounded-md',
            'bg-void-900 border',
            'text-white placeholder:text-void-500',
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
        />
        {hint && !error && <p className="text-xs text-void-500">{hint}</p>}
        {error && <p className="text-xs text-harm-400">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
