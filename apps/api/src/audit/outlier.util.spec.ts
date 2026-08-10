import { flagOutliers } from './outlier.util';

describe('flagOutliers', () => {
  it('does not flag anything with fewer than 4 observations, regardless of spread', () => {
    expect(flagOutliers([1, 1000, -1000])).toEqual([false, false, false]);
  });

  it('flags a value far outside the interquartile range using the declared IQR rule', () => {
    const values = [10, 11, 12, 13, 14, 500];

    const flags = flagOutliers(values);

    expect(flags).toEqual([false, false, false, false, false, true]);
  });

  it('flags nothing when the sample has no dispersion beyond the IQR fences', () => {
    const values = [10, 11, 12, 13, 14, 15];

    expect(flagOutliers(values)).toEqual(values.map(() => false));
  });

  it('is purely advisory: it only classifies values, it never mutates or drops them', () => {
    const values = [10, 11, 12, 13, 500];

    const flags = flagOutliers(values);

    expect(values).toEqual([10, 11, 12, 13, 500]);
    expect(flags).toHaveLength(values.length);
  });
});
