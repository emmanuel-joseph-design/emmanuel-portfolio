export type Category = 'Brand' | 'Marketing' | 'Product';
export type SectionType = 'full-image' | 'double-image' | 'video' | 'text';

interface BaseSection {
  id: string;
  order: number;
}

export interface MediaSection extends BaseSection {
  type: Exclude<SectionType, 'text'>;
  assets: string[];
  aspectRatio?: number;
  imageFit?: 'contain' | 'cover';
}

export interface TextSection extends BaseSection {
  type: 'text';
  heading: string;
  body: string;
}

export type Section = MediaSection | TextSection;

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
