import React from 'react';
import { Container } from '../layout/container';
import { Button } from '../ui/button';
import { Bot, ArrowRight, Frown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const NoPlanState = () => {
    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[20%] right-[20%] w-[40%] h-[40%] bg-muted/20 rounded-full blur-[100px]" />
            </div>

            <Container className="text-center max-w-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 relative inline-block"
                >
                    <div className="bg-muted/30 p-8 rounded-full">
                        <Bot className="h-24 w-24 text-muted-foreground stroke-[1.5]" />
                    </div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="absolute -bottom-2 -right-2 bg-background p-2 rounded-full shadow-lg border border-border"
                    >
                        <Frown className="h-8 w-8 text-orange-500" />
                    </motion.div>
                </motion.div>

                <h1 className="text-3xl font-bold mb-4 text-foreground">No Plan Generated Yet</h1>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    Beep boop... My circuits are empty! I need you to complete the assessment so I can build your personalized strategy.
                </p>

                <Link to="/questionnaire">
                    <Button size="lg" className="bg-brand hover:bg-brand/90 text-white rounded-full px-8 shadow-lg shadow-brand/20 group">
                        Start Assessment <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Link>
            </Container>
        </div>
    );
};
