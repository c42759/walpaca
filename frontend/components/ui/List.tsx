import React from "react";

export interface ListItemProps {
    icon?: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    badge?: React.ReactNode;
    actions?: React.ReactNode;
    isActive?: boolean;
    onClick?: () => void;
    className?: string;
}

export const ListItem: React.FC<ListItemProps> = ({ icon, title, subtitle, badge, actions, isActive = false, onClick, className = "" }) => {
    return (
        <div
            onClick={onClick}
            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${onClick ? "cursor-pointer select-none" : ""} ${
                isActive ? "bg-[#7678ed] text-white border-[#7678ed] shadow-md shadow-[#7678ed]/20" : "bg-white hover:bg-[#f9fafc] text-[#202022] border-[#e8ebf3]"
            } ${className}`}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {icon && <div className="shrink-0 text-base">{icon}</div>}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{title}</span>
                        {badge && <span className="shrink-0">{badge}</span>}
                    </div>
                    {subtitle && <p className={`text-xs truncate ${isActive ? "text-white/80" : "text-[#8e90a6]"}`}>{subtitle}</p>}
                </div>
            </div>
            {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
    );
};

export interface ListProps {
    children: React.ReactNode;
    className?: string;
    emptyText?: string;
}

export const List: React.FC<ListProps> = ({ children, className = "", emptyText }) => {
    const count = React.Children.count(children);
    if (count === 0 && emptyText) {
        return <div className="p-8 text-center bg-white rounded-2xl border border-[#e8ebf3] text-sm text-[#8e90a6] italic">{emptyText}</div>;
    }
    return <div className={`space-y-2 ${className}`}>{children}</div>;
};
