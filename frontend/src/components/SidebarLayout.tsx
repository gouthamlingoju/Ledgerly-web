import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

export interface SidebarItem {
    id: string;
    label: string;
    href: string;
    icon?: ReactNode;
}

export function SidebarLayout({ items, children }: { items: SidebarItem[], children: ReactNode }) {
    const location = useLocation();
    const isActive = (href: string) => {
        // For exact paths or parent paths
        if (href === '/dashboard/lending' || href === '/dashboard/contacts' || href === '/dashboard/ledger') {
            return location.pathname === href;
        }
        return location.pathname.startsWith(href);
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <aside className="w-full md:w-56 shrink-0 md:sticky md:top-24">
                <nav className="flex md:flex-col gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-border/60 md:border-b-0 md:border-r md:pr-4 md:pb-0">
                    {items.map(item => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.id}
                                to={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted hover:text-foreground hover:bg-surface'}`}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
            </aside>
            <div className="flex-1 min-w-0 w-full space-y-6 sm:space-y-8">
                {children}
            </div>
        </div>
    );
}
