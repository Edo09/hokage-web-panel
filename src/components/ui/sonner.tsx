import { useTheme } from '@/hooks/useTheme';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      duration={3200}
      toastOptions={{
        classNames: {
          toast:
            'group flex items-center gap-3 rounded-xl border border-border bg-card text-card-foreground shadow-lg text-[13px] font-medium',
          success: '[&_svg]:text-success',
          error: '[&_svg]:text-destructive',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
