// src/components/ui/alerts.ts
export function alertColor(a: string) {
    if (a.startsWith("IGNITION_UP")) return "bg-green-100 text-green-700";
    if (a.startsWith("IGNITION_DOWN")) return "bg-red-100 text-red-700";
    if (a.startsWith("EXHAUSTION_")) return "bg-amber-100 text-amber-700";
    if (a.startsWith("DD_SLOPE_")) return "bg-gray-100 text-gray-700";
    return "bg-gray-100 text-gray-700";
}
