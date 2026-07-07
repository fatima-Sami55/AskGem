import { motion } from "framer-motion";

export const Loader = () => {
    return (
        <div className="flex space-x-2 justify-center items-center h-full">
            <motion.div
                className="h-4 w-4 bg-primary rounded-full"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }}
            />
            <motion.div
                className="h-4 w-4 bg-primary rounded-full"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
            />
            <motion.div
                className="h-4 w-4 bg-primary rounded-full"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            />
        </div>
    );
};
