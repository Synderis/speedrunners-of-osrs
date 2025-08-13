export const fadeInOut = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
};

export const slideInOut = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3 }
};

export const scaleInOut = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.3 }
};

export const slideUpInOut = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -30 },
    transition: { duration: 0.3 }
};

export const hoverEffects = {
    cardHover: {
        whileHover: {
            y: -4,
            scale: 1.02,
            transition: { duration: 0.2 }
        }
    },
    buttonHover: {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.95 }
    },
    imageHover: {
        whileHover: {
            scale: 1.05,
            transition: { duration: 0.2 }
        }
    }
};
