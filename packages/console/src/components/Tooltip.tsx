import { useState } from "react";

function Tooltip({ text, title, children }: { text: string[], title?: string, children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);

    return (
        <span
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            className="relative cursor-pointer flex items-center"
        >
            {children}
            {visible && (
                <div className="absolute left-1/2 bottom-full transform -translate-x-1/2 bg-gray-800 text-white p-1.5 rounded whitespace-pre-wrap z-10">
                    {title && <><strong>{title}</strong><br /></>}
                    {text.join('\n')}
                </div>
            )}
        </span>
    );
}

export default Tooltip