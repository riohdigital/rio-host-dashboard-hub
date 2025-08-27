import React from 'react';

// Motion library exports for animations
// Using a simplified animation system without framer-motion dependency

export const motion = {
  div: ({ children, ...props }: any) => {
    const className = generateMotionClasses(props);
    return <div className={className} {...filterMotionProps(props)}>{children}</div>;
  },
  h1: ({ children, ...props }: any) => {
    const className = generateMotionClasses(props);
    return <h1 className={className} {...filterMotionProps(props)}>{children}</h1>;
  },
  h2: ({ children, ...props }: any) => {
    const className = generateMotionClasses(props);
    return <h2 className={className} {...filterMotionProps(props)}>{children}</h2>;
  },
  h3: ({ children, ...props }: any) => {
    const className = generateMotionClasses(props);
    return <h3 className={className} {...filterMotionProps(props)}>{children}</h3>;
  },
  p: ({ children, ...props }: any) => {
    const className = generateMotionClasses(props);
    return <p className={className} {...filterMotionProps(props)}>{children}</p>;
  },
  button: ({ children, ...props }: any) => {
    const className = generateMotionClasses(props);
    return <button className={className} {...filterMotionProps(props)}>{children}</button>;
  },
  blockquote: ({ children, ...props }: any) => {
    const className = generateMotionClasses(props);
    return <blockquote className={className} {...filterMotionProps(props)}>{children}</blockquote>;
  }
};

export const AnimatePresence = ({ children, mode }: any) => {
  return <>{children}</>;
};

const generateMotionClasses = (props: any) => {
  let classes = props.className || '';
  
  if (props.initial || props.animate || props.whileInView) {
    classes += ' transition-all duration-500';
  }
  
  if (props.whileHover) {
    classes += ' hover:scale-105 hover:shadow-lg transition-transform duration-300';
  }
  
  if (props.whileTap) {
    classes += ' active:scale-95';
  }
  
  return classes;
};

const filterMotionProps = (props: any) => {
  const {
    initial,
    animate,
    exit,
    transition,
    whileInView,
    whileHover,
    whileTap,
    viewport,
    ...rest
  } = props;
  
  return rest;
};