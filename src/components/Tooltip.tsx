import React, { ReactNode } from 'react';

interface TooltipProps {
    content: string;
    link?: string;
    linkText?: string;
    children?: React.ReactNode;
}

export default function Tooltip({ content, link, linkText, children }: TooltipProps) {
    return (
        <div className="relative group inline-block">
            {children}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                <div className="bg-gray-700 text-white text-xs rounded py-1 px-2 whitespace-normal max-w-xs">
                    <p>{content}</p>
                    {link && (
                        <a
                            href={link}
                            className="underline text-blue-300 mt-1 inline-block"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {linkText || 'Learn more...'}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
