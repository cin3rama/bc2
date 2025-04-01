import React, { useState, useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";

interface ClickTooltipProps {
    content: string;
    link?: string;
    linkText?: string;
}

export default function ClickTooltip({
                                         content,
                                         link,
                                         linkText,
                                     }: ClickTooltipProps) {
    const [show, setShow] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close the tooltip if clicking outside of it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setShow(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative inline-block">
            <button
                onClick={() => setShow((prev) => !prev)}
                className="flex items-center justify-center w-4 h-4 bg-gray-200 text-gray-700 rounded-full focus:outline-none"
                aria-label="More information"
            >
                <HelpCircle size={11} />
            </button>
            {show && (
                <div className="absolute z-10 mt-2 w-48 p-2 bg-gray-700 text-white text-xs rounded shadow-lg">
                    <p>{content}</p>
                    {link && (
                        <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-300 mt-1 block"
                        >
                            {linkText || "Learn more..."}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
