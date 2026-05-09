import React, { InputHTMLAttributes, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, CheckCircle2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  state?: 'default' | 'success' | 'error';
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, clearable, onClear, state = 'default', suffix, prefix, className = '', ...props }, ref) => {
    const hasError = !!error || state === 'error';
    const isSuccess = state === 'success';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-black text-gray-700 mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <div className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
              hasError ? "text-red-400" : isSuccess ? "text-emerald-500" : "text-gray-400 group-focus-within:text-emerald-500"
            )}>
              {icon}
            </div>
          )}

          {prefix && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold border-r pr-2 h-5 flex items-center">
              {prefix}
            </div>
          )}

          <input
            ref={ref}
            className={cn(
              "w-full px-4 py-3 bg-white border-2 rounded-2xl outline-none transition-all font-medium",
              icon && "pl-11",
              prefix && !icon && "pl-14",
              (suffix || clearable || isSuccess) && "pr-11",
              hasError 
                ? "border-red-100 bg-red-50/30 text-red-900 focus:border-red-500" 
                : isSuccess
                  ? "border-emerald-100 bg-emerald-50/30 text-emerald-900 focus:border-emerald-500"
                  : "border-gray-100 focus:border-emerald-500 focus:shadow-lg focus:shadow-emerald-500/5",
              className
            )}
            {...props}
          />

          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {clearable && props.value && !disabled && (
              <button
                type="button"
                onClick={onClear}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            )}

            {isSuccess && <CheckCircle2 size={18} className="text-emerald-500" />}
            
            {suffix && (
              <div className="text-gray-400 font-black text-sm">
                {suffix}
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-1.5 text-xs font-black text-red-500 flex items-center gap-1">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p className="mt-1.5 text-xs font-medium text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
const disabled = false; // dummy for compilation
