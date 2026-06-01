export const motion = {
  pageInitial: {
    opacity: 0,
    y: 10,
  },

  pageAnimate: {
    opacity: 1,
    y: 0,
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

  cardTransition: {
    duration: 0.18,
    ease: "easeOut",
  },

  layout: {
    layout: true,
    layoutRoot: true,
  },
};
