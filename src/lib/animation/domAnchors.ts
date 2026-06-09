/**
 * DOM anchor registry for animation system.
 * Components register their DOM elements so the animation layer
 * can read their screen-space positions for flying/gliding effects.
 *
 * getAnchorRect also falls back to querying [data-{type}-id="{id}"] elements
 * so data attributes in the template work automatically.
 */

export type AnchorType = 'hand' | 'board-tile' | 'score' | 'hand-area' | 'board-center' | 'avatar';

interface AnchorEntry {
	el: HTMLElement;
	type: AnchorType;
	id: string;
}

const anchors = new Map<string, AnchorEntry>();

/** Register an anchor element that animations can reference. */
export function registerAnchor(type: AnchorType, id: string, el: HTMLElement | null) {
	if (!el) {
		anchors.delete(key(type, id));
		return;
	}
	anchors.set(key(type, id), { el, type, id });
}

/** Unregister an anchor. */
export function unregisterAnchor(type: AnchorType, id: string) {
	anchors.delete(key(type, id));
}

/** Get the screen-space bounding rect of an anchor. Returns null if not found. */
export function getAnchorRect(type: AnchorType, id: string): DOMRect | null {
	// Check explicit registry first
	const entry = anchors.get(key(type, id));
	if (entry && document.contains(entry.el)) {
		return entry.el.getBoundingClientRect();
	}
	// Fallback: try to find by data-{type}-id attribute (set via template)
	const attr = `data-${type}-id`;
	const el = document.querySelector<HTMLElement>(`[${attr}="${id}"]`);
	if (el && document.contains(el)) {
		return el.getBoundingClientRect();
	}
	return null;
}

/** Get center point of an anchor. */
export function getAnchorCenter(type: AnchorType, id: string): { x: number; y: number } | null {
	const rect = getAnchorRect(type, id);
	if (!rect) return null;
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Get the board center position (from registered anchor or viewport center). */
export function getBoardCenter(): { x: number; y: number } {
	const rect = getAnchorRect('board-center', 'main');
	if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function key(type: AnchorType, id: string) {
	return `${type}:${id}`;
}
