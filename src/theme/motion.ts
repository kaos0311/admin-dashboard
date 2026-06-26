export const motion = {
  pageInitial: {
    opacity: 0,
    y: 10,
  },

  pageAnimate: {
    opacity: 1,
    y: 0,
  },

  pageExit: {
    opacity: 0,
    y: 6,
  },

  pageTransition: {
    duration: 0.22,
    ease: "easeOut",
  },

  cardInitial: {
    opacity: 0,
    y: 8,
    scale: 0.985,
  },

  cardAnimate: {
    opacity: 1,
    y: 0,
    scale: 1,
  },

  cardExit: {
    opacity: 0,
    y: 6,
    scale: 0.985,
  },

  cardTransition: {
    duration: 0.18,
    ease: "easeOut",
  },

  listContainer: {
    hidden: {
      opacity: 1,
    },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.035,
      },
    },
  },

  listItem: {
    hidden: {
      opacity: 0,
      y: 8,
    },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.16,
        ease: "easeOut",
      },
    },
  },

  modalBackdropInitial: {
    opacity: 0,
  },

  modalBackdropAnimate: {
    opacity: 1,
  },

  modalBackdropExit: {
    opacity: 0,
  },

  modalInitial: {
    opacity: 0,
    y: 12,
    scale: 0.98,
  },

  modalAnimate: {
    opacity: 1,
    y: 0,
    scale: 1,
  },

  modalExit: {
    opacity: 0,
    y: 10,
    scale: 0.98,
  },

  modalTransition: {
    duration: 0.18,
    ease: "easeOut",
  },

  drawerInitial: {
    opacity: 0,
    x: 18,
  },

  drawerAnimate: {
    opacity: 1,
    x: 0,
  },

  drawerExit: {
    opacity: 0,
    x: 18,
  },

  drawerTransition: {
    duration: 0.18,
    ease: "easeOut",
  },

  layout: {
    layout: true,
    layoutRoot: true,
  },

  reducedMotionTransition: {
    duration: 0,
  },
} as const;

export type MotionKey = keyof typeof motion;
