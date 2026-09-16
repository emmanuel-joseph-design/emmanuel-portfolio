export function validRatio(value: unknown): boolean;
export function chooseRatio(manual: number | undefined, items: { image: boolean; ratio?: number }[]): number;
export function sizeGallery(group: HTMLElement, options?: { aspectRatio?: number }): () => void;
