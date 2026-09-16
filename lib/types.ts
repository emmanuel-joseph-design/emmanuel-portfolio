export type Category = 'Brand' | 'Marketing' | 'Product';
export type SectionType = 'full-image' | 'double-image' | 'video';

export interface Section {
  id: string;
  type: SectionType;
  assets: string[];
  order: number;
  aspectRatio?: number;
  imageFit?: 'contain' | 'cover';
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  client: string;
  role: string;
  year: number;
  categories: Category[];
  cover_image: string;
  published: boolean;
  sections: Section[];
  credits: string;
  order: number;
}
