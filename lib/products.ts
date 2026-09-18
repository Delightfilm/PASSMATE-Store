import catalog from "@/data/catalog.json";

export type Product = {
  slug: string;
  code: string;
  year: number;
  title: string;
  subtitle: string;
  price: number;
  badge: string;
  description: string;
  features: string[];
};

export const products = catalog as Product[];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
