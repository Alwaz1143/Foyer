export interface Website {
  id: string;
  name: string;
  url: string;
  domain: string;
  customIcon?: string;
  orderIndex?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  websites: Website[];
  orderIndex?: number;
}
