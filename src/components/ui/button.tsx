import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // The primary action: the app's skewed red slab, label upright. One
        // per view — it's the thing to press.
        default:
          "isolate rounded-none bg-transparent text-primary-foreground before:absolute before:inset-0 before:-z-10 before:-skew-x-[10deg] before:bg-primary before:transition-[filter] before:content-[''] hover:before:brightness-110 active:before:brightness-95",
        // Everything else is quiet.
        secondary: 'bg-muted text-foreground hover:bg-muted/70',
        outline: 'border border-border-strong bg-transparent text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        destructive:
          "isolate rounded-none bg-transparent text-primary-foreground before:absolute before:inset-0 before:-z-10 before:-skew-x-[10deg] before:bg-primary before:content-[''] hover:before:brightness-110",
        // Destructive as text: for "Eliminar" next to safer actions.
        danger: 'text-destructive hover:bg-destructive/10',
        link: 'h-auto rounded-sm px-0 text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 gap-1.5 px-3 text-[13px] [&_svg]:h-3.5 [&_svg]:w-3.5',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8 [&_svg]:h-3.5 [&_svg]:w-3.5',
      },
    },
    compoundVariants: [
      // The slab leans out of its box; give its label room so it stays inside.
      { variant: 'default', size: 'default', className: 'px-5' },
      { variant: 'default', size: 'sm', className: 'px-4' },
      { variant: 'default', size: 'lg', className: 'px-7' },
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
