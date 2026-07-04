import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs))

export type ButtonVariant = 'arcane' | 'spirit' | 'ghost' | 'danger'
export type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  arcane: [
    'bg-arcane-600 hover:bg-arcane-500 active:bg-arcane-700',
    'text-void-950 font-semibold',
    'border border-arcane-500/50',
    'shadow-arcane hover:shadow-arcane',
  ].join(' '),
  spirit: [
    'bg-spirit-700 hover:bg-spirit-600 active:bg-spirit-800',
    'text-white font-semibold',
    'border border-spirit-500/50',
    'shadow-spirit hover:shadow-spirit',
  ].join(' '),
  ghost: [
    'bg-transparent hover:bg-void-800 active:bg-void-700',
    'text-void-200 hover:text-white',
    'border border-void-700/50 hover:border-void-600',
  ].join(' '),
  danger: [
    'bg-harm-600 hover:bg-harm-400/80 active:bg-harm-600',
    'text-white font-semibold',
    'border border-harm-400/30',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded',
  md: 'px-4 py-2 text-base rounded-md',
  lg: 'px-6 py-3 text-lg rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'arcane', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
