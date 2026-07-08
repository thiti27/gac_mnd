import { useEffect, useRef, useState } from "react";

export default function CountUp({
    from = 0,
    to = 100,
    duration = 1.5,
    decimals = 0,
    className = "",
}) {
    const [value, setValue] = useState(from);
    const frame = useRef();

    useEffect(() => {
        let start;
        const change = to - from;

        const animate = (timestamp) => {
            if (!start) start = timestamp;

            const progress = Math.min(
                (timestamp - start) / (duration * 1000),
                1
            );

            // Ease Out Cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            setValue(from + change * ease);

            if (progress < 1) {
                frame.current = requestAnimationFrame(animate);
            }
        };

        frame.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frame.current);
    }, [from, to, duration]);

    return (
        <span className={className}>
            {value.toFixed(decimals)}
        </span>
    );
}