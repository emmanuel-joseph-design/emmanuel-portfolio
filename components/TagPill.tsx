interface TagPillProps {
  label: string;
  variant?: 'solid' | 'outlined';
  size?: 'sm' | 'md';
  height?: number;
}

export default function TagPill({ label, variant = 'outlined', size = 'sm', height }: TagPillProps) {
  const isSolid = variant === 'solid';
  const isMd = size === 'md';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        padding: isMd ? '8px 16px' : '5px 12px',
        borderRadius: 'var(--radius-pill)',
        fontSize: isMd ? '14px' : '12px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        background: isSolid ? 'var(--purple)' : 'var(--lavender)',
        color: isSolid ? 'var(--white)' : 'var(--purple)',
        border: isSolid ? 'none' : '1px solid var(--lavender-mid)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
