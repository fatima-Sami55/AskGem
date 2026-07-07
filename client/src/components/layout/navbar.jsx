import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Container } from './container';
import { Sparkles, GraduationCap } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Navbar = () => {
    const location = useLocation();
    const hideNavLinks = ['/questionnaire', '/results', '/final-report', '/loading'].includes(location.pathname);
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Container className="flex h-16 items-center justify-between">
                <Link to="/" className="flex items-center space-x-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    <span className="font-bold text-xl tracking-tight">AskGem</span>
                </Link>
                {!hideNavLinks && (
                    <nav className="hidden md:flex items-center space-x-6">
                        <Link to="/" className="text-sm font-medium transition-colors hover:text-primary">
                            Home
                        </Link>
                        <Link to="/#features" className="text-sm font-medium transition-colors hover:text-primary">
                            Features
                        </Link>
                        <Link to="/#testimonials" className="text-sm font-medium transition-colors hover:text-primary">
                            Testimonials
                        </Link>
                    </nav>
                )}
                <div className="flex items-center space-x-4">
                    <ThemeToggle />
                </div>
            </Container>
        </header>
    );
};
