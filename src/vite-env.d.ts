/// <reference types="vite/client" />

declare module 'feather-icons' {
	type FeatherAttrs = Record<string, string | number | boolean | undefined>;

	interface FeatherIcon {
		toSvg(attrs?: FeatherAttrs): string;
	}

	interface Feather {
		replace(attrs?: FeatherAttrs): void;
		icons: Record<string, FeatherIcon>;
	}

	const feather: Feather;
	export default feather;
}
