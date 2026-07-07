import React from 'react';
import { Bot, RefreshCw, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Container } from '../layout/container';

export const ServiceBusy = ({ onRetry, retryAfter = "30 minutes" }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

            <Container className="max-w-lg text-center relative z-10 px-6">

                <div className="relative mx-auto w-32 h-32 mb-8">
                    <div className="absolute inset-0 bg-secondary/80 rounded-full animate-pulse" />
                    <div className="absolute inset-2 bg-background rounded-full flex items-center justify-center border-4 border-muted">
                        <Bot size={64} className="text-primary animate-bounce-slow" />
                    </div>
                    {/* Zzz animation could go here */}
                    <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                        Busy
                    </div>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight mb-4">
                    Brain Overload!
                </h1>

                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                    Our AI advisor is currently handling too many students.
                    <br />
                    Please give us a moment to cool down.
                </p>

                <div className="bg-secondary/30 rounded-xl p-6 mb-8 border border-border/50">
                    <div className="flex items-center justify-center gap-2 text-orange-600 font-semibold mb-2">
                        <Clock size={20} />
                        <span>Estimated Wait: {retryAfter}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        We're resetting our neural networks. Please check back shortly.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                        size="lg"
                        onClick={() => window.location.reload()}
                        className="gap-2"
                    >
                        <RefreshCw size={18} />
                        Try Again
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => window.location.href = '/'}
                    >
                        Back to Home
                    </Button>
                </div>
            </Container>
        </div>
    );
};
