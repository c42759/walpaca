import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = "primary", size = "md", isLoading = false, icon, className = "", disabled, ...props }) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold transition-all rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles = {
        primary: "bg-[#7678ed] hover:bg-[#6869d9] text-white shadow-md shadow-[#7678ed]/20",
        secondary: "bg-[#eaecf9] hover:bg-[#e0e3f5] text-[#7678ed]",
        danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20",
        ghost: "hover:bg-[#eaecf9] text-[#202022]",
        outline: "border border-[#e8ebf3] bg-white hover:bg-[#f9fafc] text-[#202022]",
    };

    const sizeStyles = {
        sm: "px-3 py-1.5 text-xs gap-1.5",
        md: "px-4 py-2.5 text-sm gap-2",
        lg: "px-5 py-3 text-base gap-2.5",
    };

    return (
        <button disabled={disabled || isLoading} className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`} {...props}>
            {isLoading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
            ) : (
                icon && <span className="shrink-0">{icon}</span>
            )}
            {children}
        </button>
    );
};
