import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { Badge } from 'lucide-react';
// Wait, Badge is not in lucide-react. ShadCn has a Badge component.
// I'll make a simple Badge-like span for now to avoid installing more things if I missed it, 
// or I can implement a simple Badge component.

const SimpleBadge = ({ children, className }) => (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80 ${className}`}>
        {children}
    </span>
);

export const UniversityCard = ({ university }) => {
    return (
        <Card className="hover:shadow-lg transition-all duration-300 border-none shadow-md bg-gradient-to-br from-card to-secondary/30 overflow-hidden group">
            <div className="h-2 w-full bg-gradient-to-r from-brand to-accent" />
            <CardHeader className="pb-2 relative">
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold leading-tight group-hover:text-brand transition-colors">
                            {university.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                            <span className="inline-block w-4 h-4 mr-1 opacity-70">📍</span>
                            {university.location}
                        </p>
                    </div>
                    {/* {university.ranking && (
                        <div className="flex flex-col items-end shrink-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Rank</span>
                            <span className="text-2xl font-black text-foreground/80 leading-none">
                                #{university.ranking.replace(/[^0-9]/g, '')}
                            </span>
                        </div>
                    )} */}
                </div>
            </CardHeader>
            <CardContent>
                <div className="mt-4 p-3 bg-background/50 rounded-xl border border-border/50 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Tuition</span>
                        <span className="font-semibold font-mono text-foreground">{university.tuition}</span>
                    </div>

                    <div className="border-t border-dashed border-border/50 my-2" />

                    <div className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Why it's a match</span>
                        <p className="text-sm leading-snug text-foreground/90">
                            {university.matchReason}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
