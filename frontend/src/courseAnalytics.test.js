import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCourseProjectSeries } from './courseAnalytics.js';

test('buildCourseProjectSeries uses course demand to generate realistic project curves', () => {
  const series = buildCourseProjectSeries([
    { count: 110, short: 'GenAI' },
    { count: 90, short: 'FullStack' },
    { count: 70, short: 'Analytics' },
  ]);

  assert.equal(series.length, 2);
  assert.ok(series.every((curve) => curve.length === 12));
  assert.ok(series[0][0] > series[1][0]);
  assert.ok(series[0][series[0].length - 1] > series[1][series[1].length - 1]);
});
