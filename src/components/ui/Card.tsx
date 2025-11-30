'use client';

import * as React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={clsx(
                'rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900',
                className
            )}
            {...props}
        />
    )
);
Card.displayName = 'Card';

export interface CardHeaderProps
    extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={clsx(
                'flex items-center justify-between border-b border-gray-300 dark:border-gray-800 px-4 py-3',
                className
            )}
            {...props}
        />
    )
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps
    extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ className, ...props }, ref) => (
        <h2
            ref={ref}
            className={clsx(
                'text-base font-medium text-text dark:text-text-inverted',
                className
            )}
            {...props}
        />
    )
);
CardTitle.displayName = 'CardTitle';

export interface CardContentProps
    extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={clsx('px-3 pb-3 pt-2', className)}
            {...props}
        />
    )
);
CardContent.displayName = 'CardContent';
