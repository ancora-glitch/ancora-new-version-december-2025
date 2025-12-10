interface PullQuoteProps {
  children: React.ReactNode;
  variant?: 'burgundy' | 'black';
}

export const PullQuote = ({ children, variant = 'burgundy' }: PullQuoteProps) => {
  const colorClass = variant === 'black' ? 'text-black' : 'text-primary';
  
  return (
    <blockquote className={`pull-quote ${colorClass}`} style={{ color: variant === 'black' ? '#000000' : undefined }}>
      {children}
    </blockquote>
  );
};
