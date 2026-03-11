import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

export interface SidebarItem {
    id: string;
    label: string;
    href: string;
    icon?: ReactNode;
}

export function SidebarLayout({ items, children }: { items: SidebarItem[], children: ReactNode }) {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [width, setWidth] = useState(240); // Initial width
    const isResizing = useRef(false);

    useEffect(() => {
        const savedWidth = localStorage.getItem('sidebarWidth');
        const savedCollapsed = localStorage.getItem('sidebarCollapsed');
        if (savedWidth) setWidth(Number(savedWidth));
        if (savedCollapsed) setIsCollapsed(savedCollapsed === 'true');
    }, []);

    const toggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebarCollapsed', String(newState));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        let newWidth = e.clientX;
        if (newWidth < 80) newWidth = 80; // Minimum width (collapsed-like)
        if (newWidth > 400) newWidth = 400; // Maximum width

        setWidth(newWidth);
        if (newWidth < 120 && !isCollapsed) {
            setIsCollapsed(true);
            localStorage.setItem('sidebarCollapsed', 'true');
        } else if (newWidth >= 120 && isCollapsed) {
            setIsCollapsed(false);
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    };

    const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
        localStorage.setItem('sidebarWidth', String(width));
    };

    const isActive = (href: string) => {
        // For exact paths or parent paths
        if (href === '/dashboard/lending' || href === '/dashboard/contacts' || href === '/dashboard/ledger') {
            return location.pathname === href;
        }
        return location.pathname.startsWith(href);
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start relative">
            <aside
                className={`shrink-0 md:sticky md:top-24 hidden md:flex flex-col transition-all duration-300 ease-in-out bg-surface border border-border rounded-2xl p-3 shadow-sm ${isCollapsed ? 'w-20' : ''}`}
                style={{ width: isCollapsed ? undefined : `${width}px` }}
            >
                <div className="flex items-center justify-between mb-4 px-2">
                    <span className={`font-bold text-xs uppercase tracking-widest text-muted transition-opacity duration-200 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>Menu</span>
                    <button
                        onClick={toggleCollapse}
                        className="p-1.5 rounded-lg text-muted hover:bg-surface-hover hover:text-foreground transition-all"
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isCollapsed ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            )}
                        </svg>
                    </button>
                </div>

                <nav className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden scrollbar-hide flex-1">
                    {items.map(item => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.id}
                                to={item.href}
                                className={`flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-semibold transition-all whitespace-nowrap group ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted hover:text-foreground hover:bg-surface-hover'}`}
                                title={isCollapsed ? item.label : undefined}
                            >
                                <div className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                                    {item.icon}
                                </div>
                                {!isCollapsed && <span>{item.label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* Resizer Handle */}
                {!isCollapsed && (
                    <div
                        className="absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize flex items-center justify-center group z-10"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="w-1 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
                    </div>
                )}
            </aside>

            {/* Mobile Nav Top Bar equivalent */}
            <aside className="w-full md:hidden mb-2">
                <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
