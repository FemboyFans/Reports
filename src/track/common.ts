export function ipv6ToSubnet(ipv6: string): string {
    const parts = ipv6.split(":");
    return `${parts.slice(0, 4).join(":")}::`;
}

export function convertIPAddress(ip: string): string {
    if (ip.includes(".")) {
        return `::ffff:${ip}`;
    }

    return ipv6ToSubnet(ip);
}

export function unconvertIPAddress(ip: string): string {
    if (ip.includes(".")) {
        return ip.replace("::ffff:", "");
    }

    return ip;
}


export function getDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function getEndOfDay(): number {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

export function normlizeDate(date: string): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
