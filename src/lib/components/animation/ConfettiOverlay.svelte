<script lang="ts">
	import { onMount } from 'svelte';
	import { runAnimation, easeOutCubic } from '$lib/animation/tween';
	import type { ConfettiIntensity } from '$lib/animation/winTypes';

	interface Props {
		centerX: number;
		centerY: number;
		intensity?: ConfettiIntensity;
		duration?: number;
	}

	let { centerX, centerY, intensity = 'normal', duration = 1500 }: Props = $props();

	const PARTICLE_COUNT = intensity === 'epic' ? 64 : 32;
	const COLORS = ['#C2410C', '#F59E0B', '#EF4444', '#22C55E', '#60A5FA', '#D4A373', '#FBBF24'];
	const GRAVITY = 320; // px of fall applied as progress^2 * GRAVITY

	interface Particle {
		color: string;
		angle: number;
		distance: number;
		rotation: number;
		size: number;
	}

	onMount(() => {
		const container = document.createElement('div');
		container.style.position = 'fixed';
		container.style.inset = '0';
		container.style.pointerEvents = 'none';
		container.style.zIndex = '40';
		document.body.appendChild(container);

		// Capture props at mount time — confetti is one-shot
		const cx = centerX;
		const cy = centerY;
		const dur = duration;
		const count = intensity === 'epic' ? 64 : PARTICLE_COUNT;

		const particles: Particle[] = Array.from({ length: count }, () => {
			const angle = Math.random() * Math.PI * 2;
			const distance = 80 + Math.random() * 180;
			return {
				color: COLORS[Math.floor(Math.random() * COLORS.length)],
				angle,
				distance,
				rotation: (Math.random() - 0.5) * 720,
				size: 6 + Math.random() * 8
			};
		});

		const els: HTMLDivElement[] = particles.map((p) => {
			const el = document.createElement('div');
			el.style.position = 'absolute';
			el.style.left = `${cx}px`;
			el.style.top = `${cy}px`;
			el.style.width = `${p.size}px`;
			el.style.height = `${p.size * 0.4}px`;
			el.style.background = p.color;
			el.style.borderRadius = '1px';
			el.style.transform = 'translate(-50%, -50%)';
			el.style.willChange = 'transform, opacity';
			container.appendChild(el);
			return el;
		});

		const controller = new AbortController();
		runAnimation({
			duration: dur,
			easing: easeOutCubic,
			abortSignal: controller.signal,
			onUpdate: (p) => {
				for (let i = 0; i < particles.length; i++) {
					const part = particles[i];
					const el = els[i];
					const radialX = Math.cos(part.angle) * part.distance * p;
					const radialY = Math.sin(part.angle) * part.distance * p;
					const gravity = p * p * GRAVITY;
					const x = cx + radialX;
					const y = cy + radialY + gravity;
					const rot = part.rotation * p;
					const op = p < 0.78 ? 1 : Math.max(0, 1 - (p - 0.78) / 0.22);
					el.style.left = `${x}px`;
					el.style.top = `${y}px`;
					el.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
					el.style.opacity = `${op}`;
				}
			}
		}).finally(() => {
			container.remove();
		});

		return () => {
			controller.abort();
			container.remove();
		};
	});
</script>
