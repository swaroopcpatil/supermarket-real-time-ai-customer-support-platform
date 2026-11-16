import { describe, expect, it } from 'vitest';
import { normalizeOffProduct } from '../openfoodfacts';

describe('normalizeOffProduct', () => {
  it('maps a real Open Food Facts record to a catalogue product', () => {
    const p = normalizeOffProduct({
      code: '8901058000290',
      product_name: 'maggi',
      brands: 'Nestlé,Maggi',
      quantity: '70 g',
      categories_tags: ['en:plant-based-foods-and-beverages', 'en:plant-based-foods', 'en:cereals-and-potatoes', 'en:pastas', 'en:noodles', 'en:instant-noodles'],
      ingredients_text: 'Refined wheat flour &amp; palm oil,\n  &quot;salt&quot;',
      nutriscore_grade: 'e',
      image_front_url: 'https://images.openfoodfacts.org/x.jpg',
    });
    expect(p).toEqual({
      barcode: '8901058000290',
      name: 'Maggi',
      brand: 'Nestlé',
      category: 'Instant Food',
      quantity_label: '70 g',
      description: null,
      ingredients: 'Refined wheat flour & palm oil, "salt"',
      nutriscore_grade: 'e',
      image_url: 'https://images.openfoodfacts.org/x.jpg',
    });
  });

  it('does not file everything under Beverages because of umbrella tags', () => {
    const ketchup = normalizeOffProduct({ code: '8901030865237', product_name: 'Tomato Ketchup', categories_tags: ['en:plant-based-foods-and-beverages', 'en:condiments', 'en:sauces', 'en:ketchups'] });
    const cola = normalizeOffProduct({ code: '8901764042706', product_name: 'Thums Up', categories_tags: ['en:beverages', 'en:carbonated-drinks', 'en:sodas', 'en:colas'] });
    const butter = normalizeOffProduct({ code: '8901262010016', product_name: 'Butter', categories_tags: ['en:dairies', 'en:fats', 'en:butters'] });
    expect(ketchup?.category).toBe('Sauces & Spreads');
    expect(cola?.category).toBe('Beverages');
    expect(butter?.category).toBe('Dairy');
  });

  it('falls back to Groceries and rejects records without a name or barcode', () => {
    expect(normalizeOffProduct({ code: '123456789012', product_name: 'Mystery', categories_tags: [] })?.category).toBe('Groceries');
    expect(normalizeOffProduct({ code: '123456789012' })).toBeNull();
    expect(normalizeOffProduct({ product_name: 'No code' })).toBeNull();
  });

  it('drops invalid nutri-score grades', () => {
    expect(normalizeOffProduct({ code: '12345678', product_name: 'X', nutriscore_grade: 'unknown' })?.nutriscore_grade).toBeNull();
  });
});
