import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'rose' | 'emerald' | 'amber' | 'sky' | 'purple' | 'slate';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const variantStyles = {
    default: 'bg-studio-800 text-slate-300 border-studio-700',
    rose: 'bg-rose-950/70 text-rose-300 border-rose-800/60',
    emerald: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60',
    amber: 'bg-amber-950/70 text-amber-300 border-amber-800/60',
    sky: 'bg-sky-950/70 text-sky-300 border-sky-800/60',
    purple: 'bg-purple-950/70 text-purple-300 border-purple-800/60',
    slate: 'bg-slate-800/80 text-slate-400 border-slate-700'
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1'
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-sm tracking-wide ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
