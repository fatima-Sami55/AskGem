import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from './button';
import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === 'dark' ? (
                <Sun className="h-[1.2rem] w-[1.2rem] text-yellow-500 transition-all hover:text-yellow-400" />
            ) : (
                <Moon className="h-[1.2rem] w-[1.2rem] text-slate-700 transition-all hover:text-slate-900" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
};
