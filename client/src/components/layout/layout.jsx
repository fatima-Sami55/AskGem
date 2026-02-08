import React from 'react';
import { Navbar } from './navbar';

export const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col">
                {children}
            </main>
            <footer className="border-t py-6 md:py-0">
                <div className="container flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Built for students. Powered by Gemini.
                    </p>
                </div>
            </footer>
        </div>
    );
};
