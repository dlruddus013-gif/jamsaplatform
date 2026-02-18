// ============================================================================
// 공통 버튼 컴포넌트
// ============================================================================

type ButtonVariant = 'primary' | 'green' | 'orange' | 'blue' | 'red' | 'kakao' | 'gray';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-museum-primary to-museum-tertiary text-white shadow-md hover:shadow-lg',
  green:
    'bg-gradient-to-br from-green-500 to-green-700 text-white shadow-md hover:shadow-lg',
  orange:
    'bg-gradient-to-br from-orange-500 to-orange-800 text-white shadow-md hover:shadow-lg',
  blue:
    'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md hover:shadow-lg',
  red:
    'bg-gradient-to-br from-red-400 to-red-800 text-white shadow-md hover:shadow-lg',
  kakao: 'bg-[#FEE500] text-[#3c1e1e] shadow-md hover:shadow-lg',
  gray: 'bg-gray-200 text-gray-600 hover:bg-gray-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[10px] rounded-md',
  md: 'px-4 py-2.5 text-xs rounded-lg',
  lg: 'px-6 py-3.5 text-sm rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        border-none font-bold cursor-pointer transition-all duration-150
        hover:-translate-y-0.5 active:translate-y-0
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
