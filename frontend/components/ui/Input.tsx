import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className='w-full space-y-1.5'>
        {label && <label className='block text-xs font-bold text-[#5d6075]'>{label}</label>}
        <input
          ref={ref}
          className={`w-full bg-[#f9fafc] border border-[#e8ebf3] text-[#202022] rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:border-[#7678ed] transition-all disabled:opacity-50 ${
            error ? 'border-rose-500 focus:border-rose-500' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className='text-xs text-rose-500 font-medium'>{error}</p>}
        {helperText && !error && <p className='text-[11px] text-[#7a7d90]'>{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', rows = 3, ...props }, ref) => {
    return (
      <div className='w-full space-y-1.5'>
        {label && <label className='block text-xs font-bold text-[#5d6075]'>{label}</label>}
        <textarea
          ref={ref}
          rows={rows}
          className={`w-full bg-white border border-[#e8ebf3] text-[#202022] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#7678ed] transition-all resize-y disabled:opacity-50 ${
            error ? 'border-rose-500 focus:border-rose-500' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className='text-xs text-rose-500 font-medium'>{error}</p>}
        {helperText && !error && <p className='text-[11px] text-[#7a7d90]'>{helperText}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
