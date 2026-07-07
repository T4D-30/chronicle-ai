/**
 * HeroPanel — shared premium card surface for marketing/auth screens.
 * One definition of the "framed panel" look (glow + border + blur) so
 * Landing's CTA panel and the Login/Signup auth cards stay visually
 * identical. Size, padding, and layout are controlled by the caller
 * via className.
 */

import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface HeroPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const HeroPanel = forwardRef<HTMLDivElement, HeroPanelProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('chr-panel-hero', className)} {...props}>
      {children}
    </div>
  ),
)
HeroPanel.displayName = 'HeroPanel'
