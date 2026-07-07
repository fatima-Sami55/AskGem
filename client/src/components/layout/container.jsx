import React from 'react';
import { cn } from '../../lib/utils';

export const Container = ({ children, className }) => {
    return (
        <div className={cn("container mx-auto px-4 md:px-6", className)}>
            {children}
        </div>
    );
};
