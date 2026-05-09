import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FilterChipGroupProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  scrollable?: boolean;    // scroll horizontal en mobile, default true
  gap?: 'xs' | 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const FilterChipGroup: React.FC<FilterChipGroupProps> = ({
  value,
  onChange,
  multiple = false,
  scrollable = true,
  gap = 'sm',
  children,
  className,
}) => {
  const gapStyles = {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
  };

  return (
    <div className={cn(
      'flex items-center',
      scrollable && 'overflow-x-auto no-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap',
      gapStyles[gap],
      className
    )}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<FilterChipProps>(child)) return null;

        const isSelected = multiple
          ? Array.isArray(value) && value.includes(child.props.value)
          : value === child.props.value;

        const handleClick = () => {
          if (multiple) {
            const newValue = Array.isArray(value) ? [...value] : [];
            if (isSelected) {
              onChange(newValue.filter((v) => v !== child.props.value));
            } else {
              onChange([...newValue, child.props.value]);
            }
          } else {
            onChange(child.props.value);
          }
        };

        return React.cloneElement(child, {
          isSelected,
          onClick: handleClick,
        });
      })}
    </div>
  );
};

interface FilterChipProps {
  value: string;
  icon?: string | React.ReactNode;
  count?: number;           // badge circular con conteo
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  // Internal props
  isSelected?: boolean;
  onClick?: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({
  icon,
  count,
  disabled,
  children,
  className,
  isSelected,
  onClick,
}) => {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black transition-all whitespace-nowrap border',
        isSelected
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
          : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 hover:text-gray-800',
        disabled && 'opacity-40 cursor-not-allowed grayscale',
        className
      )}
    >
      {icon && (
        <span className="flex-shrink-0">
          {typeof icon === 'string' ? (
            <span role="img" aria-label="chip icon">{icon}</span>
          ) : (
            icon
          )}
        </span>
      )}
      <span>{children}</span>
      {count !== undefined && count > 0 && (
        <span className={cn(
          'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black',
          isSelected ? 'bg-white text-emerald-600' : 'bg-gray-200 text-gray-500'
        )}>
          {count}
        </span>
      )}
    </button>
  );
};

export const FilterChipComponent = Object.assign(FilterChip, {
  Group: FilterChipGroup,
});

export { FilterChipComponent as FilterChip };
