// data_scraper.ts
import { chromium } from 'playwright';
import type { Page, ConsoleMessage, Worker } from 'playwright';
import * as fs from 'fs';

const URL = 'https://tools.runescape.wiki/osrs-dps/';
const INPUT_SELECTOR = '#monster-select-input';
const MENU_SELECTOR = '#monster-select-menu';
const OPTION_SELECTOR = `${MENU_SELECTOR} [role="option"], ${MENU_SELECTOR} li[role="option"], ${MENU_SELECTOR} [data-option], ${MENU_SELECTOR} li`;
const MATCH_REGEX = /\|\s*(\{[\s\S]*\})\s*$/;

// ---- Limit: stop after N labels (0 = no limit). CLI override: --limit=NN
const DEFAULT_LABEL_LIMIT = 25;
const LABEL_LIMIT = (() => {
    const arg = process.argv.find(a => a.startsWith('--limit='));
    return arg ? Math.max(0, parseInt(arg.split('=')[1], 10) || 0) : DEFAULT_LABEL_LIMIT;
})();

type Monster = any;

async function main() {
    const browser = await chromium.launch({ headless: false });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    if (LABEL_LIMIT) console.log(`⏱ Limiting to ${LABEL_LIMIT} labels for testing.`);

    // ---- Capture logs from page and workers ----
    const captured: Monster[] = [];
    const seenMonsters = new Set<string>();

    const handleLog = (msg: ConsoleMessage) => {
        const text = msg.text();
        const m = text.match(MATCH_REGEX);
        if (!m) return;

        try {
            const payload = JSON.parse(m[1]);
            const monster = payload?.data?.monster;
            if (!monster) return;

            const key = `${monster.id}#${monster.version ?? ''}`;
            if (!seenMonsters.has(key)) {
                seenMonsters.add(key);
                captured.push(monster);
                console.log(`+ captured monster: ${monster.name} (${key})`);
            }
        } catch { /* ignore parse errors */ }
    };

    (page.on as any)('console', handleLog);
    (page.on as any)('worker', (worker: Worker) => (worker.on as any)('console', handleLog));

    // ---- Helpers ----
    async function openMenu(p: Page) {
        const input = p.locator(INPUT_SELECTOR);
        await input.click({ force: true });
        await p.waitForSelector(MENU_SELECTOR, { state: 'visible' });
        await p.waitForTimeout(150); // let items render
    }

    // IMPORTANT: no function declarations inside evaluate (avoids __name helper)
    async function resolveScroller(p: Page) {
        await p.waitForSelector(MENU_SELECTOR, { state: 'attached' });
        const menu = p.locator(MENU_SELECTOR);

        await menu.evaluate((menuEl) => {
            let scroller: HTMLElement | null = null;

            // Try common candidates
            const candidateSelectors = [
                '[role="listbox"]',
                '[data-radix-scroll-area-viewport]',
                '.overflow-y-auto',
                '.overflow-auto',
                '.overflow-scroll',
                '[data-scrollable="true"]'
            ];

            for (let i = 0; i < candidateSelectors.length && !scroller; i++) {
                const nodes = menuEl.querySelectorAll(candidateSelectors[i]) as NodeListOf<HTMLElement>;
                for (let j = 0; j < nodes.length && !scroller; j++) {
                    const el = nodes[j];
                    const cs = getComputedStyle(el);
                    const oy = cs.overflowY || cs.overflow;
                    if (el.scrollHeight > el.clientHeight && (oy === 'auto' || oy === 'scroll' || oy === 'overlay')) {
                        scroller = el;
                    }
                }
            }

            // Fallback: walk descendants to find first scrollable
            if (!scroller) {
                const walker = document.createTreeWalker(menuEl, NodeFilter.SHOW_ELEMENT);
                while (walker.nextNode()) {
                    const el = walker.currentNode as HTMLElement;
                    const cs = getComputedStyle(el);
                    const oy = cs.overflowY || cs.overflow;
                    if (el.scrollHeight > el.clientHeight && (oy === 'auto' || oy === 'scroll' || oy === 'overlay')) {
                        scroller = el;
                        break;
                    }
                }
            }

            (scroller ?? menuEl).setAttribute('data-scraper-scroller', '1');
        });

        return p.locator(`${MENU_SELECTOR} [data-scraper-scroller="1"], ${MENU_SELECTOR}[data-scraper-scroller="1"]`);
    }

    async function discoverAllLabels(p: Page): Promise<string[]> {
        await openMenu(p);

        const scroller = await resolveScroller(p);
        await scroller.evaluate((el) => { (el as HTMLElement).scrollTop = 0; });
        await p.waitForTimeout(120);

        const seenLabels = new Set<string>();
        let stablePasses = 0;
        let reachedLimit = false;

        async function grabVisible() {
            const texts = await p.locator(OPTION_SELECTOR).allTextContents();
            for (const raw of texts) {
                const t = raw.replace(/\s+/g, ' ').trim();
                if (t && !seenLabels.has(t)) {
                    seenLabels.add(t);
                    if (LABEL_LIMIT && seenLabels.size >= LABEL_LIMIT) {
                        reachedLimit = true;
                        break;
                    }
                }
            }
        }

        await grabVisible();
        if (reachedLimit) {
            await p.mouse.click(5, 5);
            await p.waitForTimeout(80);
            return Array.from(seenLabels);
        }

        // Scroll down in steps; harvest after each step until no new labels
        for (let guard = 0; guard < 600; guard++) {
            const before = seenLabels.size;

            const atBottom = await scroller.evaluate((el) => {
                const h = el as HTMLElement;
                const prev = h.scrollTop;
                h.scrollTop = Math.min(h.scrollTop + 320, h.scrollHeight);
                return h.scrollTop === prev;
            });

            await p.waitForTimeout(120);
            await grabVisible();

            if (reachedLimit) break;

            if (seenLabels.size === before) stablePasses++; else stablePasses = 0;
            if (atBottom && stablePasses >= 3) break;
        }

        // Optional upward sweep
        if (!reachedLimit) {
            for (let i = 0; i < 15; i++) {
                await scroller.evaluate((el) => {
                    const h = el as HTMLElement;
                    h.scrollTop = Math.max(0, h.scrollTop - 240);
                });
                await p.waitForTimeout(60);
                await grabVisible();
                if (reachedLimit) break;
            }
        }

        await p.mouse.click(5, 5);
        await p.waitForTimeout(80);

        return Array.from(seenLabels);
    }

    async function clickLabel(p: Page, label: string) {
        await openMenu(p);
        const scroller = await resolveScroller(p);

        for (let pass = 0; pass < 400; pass++) {
            const option = p.locator(OPTION_SELECTOR).filter({ hasText: label });
            if (await option.first().count()) {
                await option.first().scrollIntoViewIfNeeded();
                await option.first().click();
                return true;
            }
            const atBottom = await scroller.evaluate((el) => {
                const h = el as HTMLElement;
                const prev = h.scrollTop;
                h.scrollTop = Math.min(h.scrollTop + 320, h.scrollHeight);
                return h.scrollTop === prev;
            });
            if (atBottom) break;
            await p.waitForTimeout(50);
        }

        console.warn(`Option not found after scrolling: "${label}"`);
        return false;
    }

    // ---- Run the scraping flow ----
    console.log('Discovering dropdown labels…');
    const labelsDiscovered = await discoverAllLabels(page);
    const labels = LABEL_LIMIT ? labelsDiscovered.slice(0, LABEL_LIMIT) : labelsDiscovered;
    console.log(`Discovered ${labels.length}${LABEL_LIMIT ? ` (limited to ${LABEL_LIMIT})` : ''} labels`);

    for (const label of labels) {
        const ok = await clickLabel(page, label);
        if (!ok) continue;
        await page.waitForTimeout(250); // let the app/worker emit its console line
    }

    // ---- Save results ----
    const outPath = 'monsters.json';
    fs.writeFileSync(outPath, JSON.stringify(captured, null, 2));
    console.log(`\nSaved ${captured.length} unique monster entries -> ${outPath}`);

    await browser.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
