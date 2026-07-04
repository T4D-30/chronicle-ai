import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs))

export type BadgeVariant = 'arcane' | 'spirit' | 'harm' | 'heal' | 'neutral'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  arcane: 'bg-arcane-900/50 border-arcane-700/50 text-arcane-300',
  spirit: 'bg-spirit-900/50 border-spirit-700/50 text-spirit-300',
  harm: 'bg-harm-600/15 border-harm-600/40 text-harm-400',
  heal: 'bg-heal-600/15 border-heal-600/40 text-heal-400',
  neutral: 'bg-void-800 border-void-600/50 text-void-300',
}

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'text-xs font-body font-medium border',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
