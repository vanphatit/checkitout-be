import { slugifyVietnamese } from './slugify.util';

describe('slugifyVietnamese', () => {
  it('should convert Vietnamese text to uppercase slug', () => {
    expect(slugifyVietnamese('Giáng sinh vui vẻ')).toBe('GIANG_SINH_VUI_VE');
  });

  it('should handle special characters', () => {
    expect(slugifyVietnamese('Khuyến mãi 20%!')).toBe('KHUYEN_MAI_20');
  });

  it('should handle multiple spaces', () => {
    expect(slugifyVietnamese('Tết   Nguyên   Đán')).toBe('TET_NGUYEN_DAN');
  });

  it('should handle leading/trailing spaces', () => {
    expect(slugifyVietnamese('  Giảm giá  ')).toBe('GIAM_GIA');
  });

  it('should handle all Vietnamese characters', () => {
    expect(slugifyVietnamese('àáảãạăằắẳẵặâầấẩẫậ')).toBe('AAAAAAAAAAAAAAAAA'); // 17 A's
    expect(slugifyVietnamese('èéẻẽẹêềếểễệ')).toBe('EEEEEEEEEEE'); // 11 E's
    expect(slugifyVietnamese('đ')).toBe('D');
  });

  it('should handle empty string', () => {
    expect(slugifyVietnamese('')).toBe('');
  });

  it('should handle numbers', () => {
    expect(slugifyVietnamese('Khuyến mãi 2024')).toBe('KHUYEN_MAI_2024');
  });

  it('should remove special characters', () => {
    expect(slugifyVietnamese('Sale!@#$%^&*()')).toBe('SALE');
  });
});
