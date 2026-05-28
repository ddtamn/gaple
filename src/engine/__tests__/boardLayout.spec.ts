import { describe, expect, it } from 'vitest';
import { calculateBoardLayout, calculateBoardPreviewPosition } from '../boardLayout';
import type { Domino } from '../types';

function tile(index: number): Domino {
	return {
		id: `tile-${index}`,
		left: index % 7,
		right: (index + 1) % 7
	};
}

describe('Board layout', () => {
	it('snakes the right arm in a smoother zig-zag', () => {
		expect.assertions(6);
		const layout = calculateBoardLayout(Array.from({ length: 8 }, (_, index) => tile(index)), 0);

		expect(layout[1]).toMatchObject({ x: 116, y: 0, rotation: 0 });
		expect(layout[3]).toMatchObject({ x: 348, y: 0, rotation: 0 });
		expect(layout[4]).toMatchObject({ x: 348, y: 60, rotation: 180 });
		expect(layout[5]).toMatchObject({ x: 232, y: 60, rotation: 180 });
		expect(layout[6]).toMatchObject({ x: 116, y: 60, rotation: 180 });
		expect(Math.max(...layout.map((item) => item.x))).toBe(348);
	});

	it('mirrors the snake path for the left arm', () => {
		expect.assertions(6);
		const layout = calculateBoardLayout(Array.from({ length: 8 }, (_, index) => tile(index)), 7);

		expect(layout[6]).toMatchObject({ x: -116, rotation: 0 });
		expect(layout[4]).toMatchObject({ x: -348, rotation: 0 });
		expect(layout[3]).toMatchObject({ x: -348, y: -60, rotation: 180 });
		expect(layout[2]).toMatchObject({ x: -232, y: -60, rotation: 180 });
		expect(layout[1]).toMatchObject({ x: -116, y: -60, rotation: 180 });
		expect(Math.min(...layout.map((item) => item.x))).toBe(-348);
	});

	it('places the ghost preview at the next snake slot', () => {
		expect.assertions(2);
		const tiles = Array.from({ length: 4 }, (_, index) => tile(index));

		expect(calculateBoardPreviewPosition(tiles, 0, 'right')).toMatchObject({
			x: 348,
			y: 60,
			rotation: 180,
			side: 'right'
		});
		expect(calculateBoardPreviewPosition(tiles, 3, 'left')).toMatchObject({
			x: -348,
			y: -60,
			rotation: 180,
			side: 'left'
		});
	});
});
