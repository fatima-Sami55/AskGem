import React from 'react';
import { Container } from '../components/layout/container';
import { useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { UniversityCard } from '../components/features/UniversityCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Download, Share2, MapPin, GraduationCap, DollarSign, Calendar, Trophy, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Results = () => {
    const location = useLocation();
    const { results, roadmap, error } = location.state || {};

    // Data Mapping
    const apiRecommendations = results?.data?.recommendations || [];
    const displayResults = apiRecommendations.length > 0 ? apiRecommendations.map(rec => ({
        name: rec.university,
        location: rec.country,
        ranking: rec.ranking,
        tuition: rec.tuition_fees,
        matchReason: rec.why_this_choice
    })) : [
        { name: "Technical University of Munich", location: "Germany", ranking: "#37", tuition: "€0", matchReason: "Top tier CS program with low fees." },
        { name: "University of Toronto", location: "Canada", ranking: "#21", tuition: "$45k", matchReason: "Strong industry connections." },
    ];

    const apiScholarships = results?.data?.top_scholarships || [];
    const displayScholarships = apiScholarships.length > 0 ? apiScholarships : [
        { name: "DAAD Scholarship", amount: "€850/month", deadline: "Oct 15" },
        { name: "Erasmus Mundus", amount: "Full Ride", deadline: "Jan 10" },
    ];

    const apiRoadmap = roadmap?.data?.roadmap || [];
    const displayRoadmap = apiRoadmap.length > 0 ? apiRoadmap.map(step => ({
        phase: step.phase,
        title: step.description || step.phase,
        action: step.actions.join('. ')
    })) : [
        { phase: "Month 1-2", title: "Foundation & Prep", action: "Prepare English proficiency tests (IELTS/TOEFL). Draft initial Personal Statement." },
        { phase: "Month 3-5", title: "Applications", action: "Submit applications to TU Munich and UofT. Apply for DAAD scholarship." }
    ];

    return (
        <div className="bg-background min-h-screen pb-20 relative">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="bg-background/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/50">
                <Container className="py-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 p-1.5 rounded-lg"><GraduationCap size={24} /></span>
                                Your Personalized Plan
                            </h1>
                        </div>
                        <div className="flex gap-3">

                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                        </div>
                    </div>
                </Container>
            </div>

            <Container className="py-12 space-y-16">
                {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                        Warning: Could not fetch live AI data. Showing sample recommendations.
                    </motion.div>
                )}

                {/* Universities Section */}
                <section>
                    <SectionHeader icon={<MapPin className="text-blue-500" />} title="Top University Matches" subtitle="Curated based on your academic profile and preferences." />
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayResults.map((uni, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <UniversityCard university={uni} />
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Scholarships Section */}
                <section>
                    <SectionHeader icon={<Trophy className="text-amber-500" />} title="Eligible Scholarships" subtitle="High-probability funding opportunities found for you." />
                    <div className="grid md:grid-cols-2 gap-6">
                        {displayScholarships.map((schol, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + (idx * 0.1) }}
                            >
                                <Card className="overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-amber-500 bg-card">
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <Trophy size={80} className="text-amber-500 rotate-12 translate-x-4 -translate-y-4" />
                                    </div>
                                    <CardHeader className="pb-2 relative z-10">
                                        <div className="flex justify-between items-start gap-2">
                                            <CardTitle className="text-xl font-bold text-foreground">
                                                {schol.name}
                                            </CardTitle>
                                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap">
                                                Match Found
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="relative z-10">
                                        <div className="space-y-3 mt-1">
                                            <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                                                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md text-green-600 dark:text-green-400">
                                                    <DollarSign className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Value</p>
                                                    <p className="font-bold text-foreground">{schol.amount}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                                                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400">
                                                    <Calendar className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Deadline</p>
                                                    <p className="font-medium text-foreground">{schol.deadline}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Roadmap Section - Vertical Timeline */}
                <section>
                    <SectionHeader icon={<CheckCircle className="text-green-500" />} title="Your Action Roadmap" subtitle="A step-by-step timeline to guide your application journey." />

                    <div className="relative pl-8 md:pl-0">
                        {/* Timeline Center Line (Desktop) / Left Line (Mobile) */}
                        <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-1/2 nav-line" />

                        <div className="space-y-12">
                            {displayRoadmap.map((step, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    className={`relative flex flex-col md:flex-row gap-8 ${idx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
                                >
                                    {/* Content Card */}
                                    <div className="flex-1">
                                        <div className={`bg-card p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow relative ${idx % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                                            <span className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1 block">
                                                {step.phase}
                                            </span>
                                            <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                            <p className="text-muted-foreground leading-relaxed">
                                                {step.action}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Center Node */}
                                    <div className="absolute left-[-5px] md:left-1/2 md:-translate-x-1/2 w-3 h-3 bg-background border-2 border-primary rounded-full z-10 mt-6 ring-4 ring-background">
                                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                    </div>

                                    {/* Spacer for Alternate Side */}
                                    <div className="flex-1 hidden md:block" />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            </Container>
        </div>
    );
};

const SectionHeader = ({ icon, title, subtitle }) => (
    <div className="mb-8 flex items-start gap-4">
        <div className="mt-1 p-2 bg-secondary rounded-lg border border-border">
            {icon}
        </div>
        <div>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
        </div>
    </div>
)

export default Results;
