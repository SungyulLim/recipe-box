const MENU_URL = "https://smart.handong.edu/api/service/menu";

const cafeterias = [
    {
        key: "haksik",
        name: "학생식당",
        slots: [
            { cornerId: "deundeun", corner: "든든한동", meal: "아침" },
            { cornerId: "deundeun", corner: "든든한동", meal: "점심" },
            { cornerId: "deundeun", corner: "든든한동", meal: "저녁" },
            { cornerId: "hplate", corner: "H:plate" },
            { cornerId: "asian-market", corner: "Asian Market" },
            { cornerId: "hans-deli", corner: "Han’s Deli" },
            { cornerId: "ttaseuhan", corner: "따스한동" },
        ],
    },
    { key: "moms", name: "맘스키친", slots: [{ meal: "아침" }, { meal: "점심" }, { meal: "저녁" }] },
    // HISNet's first Lounge row is the staff-only lunch.
    { key: "hyoam", name: "라운지", slots: [null, { meal: "점심" }, { meal: "저녁" }] },
];

const seoulDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });

export function todayInKorea() {
    return seoulDate.format(new Date());
}

function splitMenuOptions(menuText) {
    // The API puts "or" on its own line between meal choices.
    const choices = (menuText ?? "").split(/^[^\S\r\n]*or[^\S\r\n]*\r?$/im);
    const options = [];

    for (const choice of choices) {
        const dishes = [];
        for (const line of choice.split(/\r?\n/)) {
            const text = line.trim();
            const isOriginLabel = /^[-<\s]*원산지\s*:/.test(text);
            const isSideDishHeading = /^\*\s*오늘의\s*반찬\s*$/.test(text);
            if (!text || isOriginLabel || isSideDishHeading) continue;

            const name = text.replace(/^-\s+/, "").replace(/^\[\s*(.*?)\s*\]$/, "$1").trim();
            if (name) dishes.push(name.normalize("NFC").replace(/\s+/g, " "));
        }

        if (dishes.length > 0) options.push(dishes);
    }

    return options;
}

async function makeDish(cafeteria, slot, name) {
    // Match the IDs in the menu archive. The serving date is intentionally omitted.
    const key = [cafeteria.key, slot.cornerId ?? "", name].join("|");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const dishId = Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");

    return {
        dishId,
        name,
        cafeteriaId: cafeteria.key,
        cafeteria: cafeteria.name,
        cornerId: slot.cornerId ?? null,
        corner: slot.corner ?? null,
    };
}

export async function normalizeMenu(data) {
    const menu = [];

    for (const cafeteria of cafeterias) {
        const rows = data?.[cafeteria.key];
        // A shorter layout may shift the meal labels and the staff-only row.
        const hasExpectedRows = Array.isArray(rows)
            && (rows.length === 0 || rows.length === cafeteria.slots.length);
        if (!hasExpectedRows) {
            throw new Error(`Unexpected menu layout for ${cafeteria.key}`);
        }

        const sections = [];
        for (const [index, row] of rows.entries()) {
            const slot = cafeteria.slots[index];
            if (!slot) continue;

            const namesByOption = splitMenuOptions(row?.menu_kor);
            if (!namesByOption.length) continue;

            const options = await Promise.all(namesByOption.map((names) => {
                const dishes = names.map((name) => makeDish(cafeteria, slot, name));
                return Promise.all(dishes);
            }));
            const label = [slot.corner, slot.meal].filter(Boolean).join(" · ");
            sections.push({ sourceRow: index + 1, label, options });
        }

        menu.push({ key: cafeteria.key, name: cafeteria.name, sections });
    }

    return menu;
}

export async function fetchMenu(date, signal) {
    const url = new URL(MENU_URL);
    url.searchParams.set("date", date.replaceAll("-", ""));

    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error(`Menu request failed (${response.status})`);
    }

    return normalizeMenu(await response.json());
}
