import * as memCache from './cache/memory';
import {
  AbandonedPackageStats,
  DatasourceCacheStats,
  HttpCacheStats,
  HttpStats,
  LookupStats,
  PackageCacheStats,
  makeTimingReport,
} from './stats';
import { logger } from '~test/util';

describe('util/stats', () => {
  beforeEach(() => {
    memCache.init();
  });

  describe('makeTimingReport', () => {
    it('supports empty data', () => {
      const res = makeTimingReport([]);
      expect(res).toEqual({
        avgMs: 0,
        count: 0,
        maxMs: 0,
        medianMs: 0,
        totalMs: 0,
      });
    });

    it('supports single data point', () => {
      const res = makeTimingReport([100]);
      expect(res).toEqual({
        avgMs: 100,
        count: 1,
        maxMs: 100,
        medianMs: 100,
        totalMs: 100,
      });
    });

    it('supports multiple data points', () => {
      const res = makeTimingReport([100, 200, 400]);
      expect(res).toEqual({
        avgMs: 233,
        count: 3,
        maxMs: 400,
        medianMs: 200,
        totalMs: 700,
      });
    });
  });

  describe('LookupStats', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns empty report', () => {
      const res = LookupStats.getReport();
      expect(res).toEqual({});
    });

    it('writes data points', () => {
      LookupStats.write('npm', 100);
      LookupStats.write('npm', 200);
      LookupStats.write('npm', 400);
      LookupStats.write('docker', 1000);

      const res = LookupStats.getReport();

      expect(res).toEqual({
        docker: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
        npm: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
      });
    });

    it('wraps a function', async () => {
      const res = await LookupStats.wrap('npm', () => {
        vi.advanceTimersByTime(100);
        return Promise.resolve('foo');
      });

      expect(res).toBe('foo');
      expect(LookupStats.getReport()).toEqual({
        npm: {
          avgMs: 100,
          count: 1,
          maxMs: 100,
          medianMs: 100,
          totalMs: 100,
        },
      });
    });

    it('logs report', () => {
      LookupStats.write('npm', 100);
      LookupStats.write('npm', 200);
      LookupStats.write('npm', 400);
      LookupStats.write('docker', 1000);

      LookupStats.report();

      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
      const [data, msg] = logger.logger.debug.mock.calls[0];
      expect(msg).toBe('Lookup statistics');
      expect(data).toEqual({
        docker: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
        npm: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
      });
    });
  });

  describe('PackageCacheStats', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('returns empty report', () => {
      const res = PackageCacheStats.getReport();
      expect(res).toEqual({
        get: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
        set: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
      });
    });

    it('writes data points', () => {
      PackageCacheStats.writeGet(100);
      PackageCacheStats.writeGet(200);
      PackageCacheStats.writeGet(400);
      PackageCacheStats.writeSet(1000);

      const res = PackageCacheStats.getReport();

      expect(res).toEqual({
        get: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
        set: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
      });
    });

    it('wraps get function', async () => {
      const res = await PackageCacheStats.wrapGet(() => {
        vi.advanceTimersByTime(100);
        return Promise.resolve('foo');
      });

      expect(res).toBe('foo');
      expect(PackageCacheStats.getReport()).toEqual({
        get: { avgMs: 100, count: 1, maxMs: 100, medianMs: 100, totalMs: 100 },
        set: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
      });
    });

    it('wraps set function', async () => {
      await PackageCacheStats.wrapSet(() => {
        vi.advanceTimersByTime(100);
        return Promise.resolve();
      });

      expect(PackageCacheStats.getReport()).toEqual({
        get: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
        set: { avgMs: 100, count: 1, maxMs: 100, medianMs: 100, totalMs: 100 },
      });
    });

    it('logs report', () => {
      PackageCacheStats.writeGet(100);
      PackageCacheStats.writeGet(200);
      PackageCacheStats.writeGet(400);
      PackageCacheStats.writeSet(1000);

      PackageCacheStats.report();

      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
      const [data, msg] = logger.logger.debug.mock.calls[0];
      expect(msg).toBe('Package cache statistics');
      expect(data).toEqual({
        get: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
        set: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
      });
    });
  });

  describe('DatasourceCacheStats', () => {
    it('collects data points', () => {
      DatasourceCacheStats.hit('crate', 'https://foo.example.com', 'foo');
      DatasourceCacheStats.miss('maven', 'https://bar.example.com', 'bar');
      DatasourceCacheStats.set('npm', 'https://baz.example.com', 'baz');
      DatasourceCacheStats.skip('rubygems', 'https://qux.example.com', 'qux');

      const report = DatasourceCacheStats.getReport();

      expect(report).toEqual({
        long: {
          crate: {
            'https://foo.example.com': { foo: { read: 'hit' } },
          },
          maven: {
            'https://bar.example.com': { bar: { read: 'miss' } },
          },
          npm: {
            'https://baz.example.com': { baz: { write: 'set' } },
          },
          rubygems: {
            'https://qux.example.com': { qux: { write: 'skip' } },
          },
        },
        short: {
          crate: {
            'https://foo.example.com': { hit: 1, miss: 0, set: 0, skip: 0 },
          },
          maven: {
            'https://bar.example.com': { hit: 0, miss: 1, set: 0, skip: 0 },
          },
          npm: {
            'https://baz.example.com': { hit: 0, miss: 0, set: 1, skip: 0 },
          },
          rubygems: {
            'https://qux.example.com': { hit: 0, miss: 0, set: 0, skip: 1 },
          },
        },
      });
    });

    it('reports', () => {
      DatasourceCacheStats.hit('crate', 'https://foo.example.com', 'foo');
      DatasourceCacheStats.miss('maven', 'https://bar.example.com', 'bar');
      DatasourceCacheStats.set('npm', 'https://baz.example.com', 'baz');
      DatasourceCacheStats.skip('rubygems', 'https://qux.example.com', 'qux');

      DatasourceCacheStats.report();

      expect(logger.logger.trace).toHaveBeenCalledTimes(1);
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe('HttpStats', () => {
    it('returns empty report', () => {
      const res = HttpStats.getReport();
      expect(res).toEqual({
        hostRequests: {},
        hosts: {},
        rawRequests: [],
        requests: 0,
        urls: {},
      });
    });

    it('writes data points', () => {
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/foo',
        reqMs: 100,
        queueMs: 10,
        status: 200,
      });
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/foo',
        reqMs: 200,
        queueMs: 20,
        status: 200,
      });
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/bar',
        reqMs: 400,
        queueMs: 40,
        status: 200,
      });
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/foo',
        reqMs: 800,
        queueMs: 80,
        status: 404,
      });
      HttpStats.write({
        method: 'GET',
        url: '<invalid>',
        reqMs: 100,
        queueMs: 100,
        status: 400,
      });

      const res = HttpStats.getReport();

      expect(res).toEqual({
        hostRequests: {
          'example.com': [
            {
              method: 'GET',
              queueMs: 40,
              reqMs: 400,
              status: 200,
              url: 'https://example.com/bar',
            },
            {
              method: 'GET',
              queueMs: 10,
              reqMs: 100,
              status: 200,
              url: 'https://example.com/foo',
            },
            {
              method: 'GET',
              queueMs: 20,
              reqMs: 200,
              status: 200,
              url: 'https://example.com/foo',
            },
            {
              method: 'GET',
              queueMs: 80,
              reqMs: 800,
              status: 404,
              url: 'https://example.com/foo',
            },
          ],
        },
        hosts: {
          'example.com': {
            count: 4,
            queueAvgMs: 38,
            queueMaxMs: 80,
            queueMedianMs: 40,
            reqAvgMs: 375,
            reqMaxMs: 800,
            reqMedianMs: 400,
          },
        },
        rawRequests: [
          'GET https://example.com/bar 200 400 40',
          'GET https://example.com/foo 200 100 10',
          'GET https://example.com/foo 200 200 20',
          'GET https://example.com/foo 404 800 80',
        ],
        requests: 5,
        urls: {
          'https://example.com/bar': {
            GET: {
              '200': 1,
            },
          },
          'https://example.com/foo': {
            GET: {
              '200': 2,
              '404': 1,
            },
          },
        },
      });
    });

    it('logs report', () => {
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/foo',
        reqMs: 100,
        queueMs: 10,
        status: 200,
      });
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/foo',
        reqMs: 200,
        queueMs: 20,
        status: 200,
      });
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/bar',
        reqMs: 400,
        queueMs: 40,
        status: 200,
      });
      HttpStats.write({
        method: 'GET',
        url: 'https://example.com/foo',
        reqMs: 800,
        queueMs: 80,
        status: 404,
      });

      HttpStats.report();

      expect(logger.logger.trace).toHaveBeenCalledTimes(2);
      const [traceData, traceMsg] = logger.logger.trace.mock.calls[0];
      expect(traceMsg).toBe('HTTP full statistics');
      expect(traceData).toEqual({
        rawRequests: [
          'GET https://example.com/bar 200 400 40',
          'GET https://example.com/foo 200 100 10',
          'GET https://example.com/foo 200 200 20',
          'GET https://example.com/foo 404 800 80',
        ],
        hostRequests: {
          'example.com': [
            {
              method: 'GET',
              queueMs: 40,
              reqMs: 400,
              status: 200,
              url: 'https://example.com/bar',
            },
            {
              method: 'GET',
              queueMs: 10,
              reqMs: 100,
              status: 200,
              url: 'https://example.com/foo',
            },
            {
              method: 'GET',
              queueMs: 20,
              reqMs: 200,
              status: 200,
              url: 'https://example.com/foo',
            },
            {
              method: 'GET',
              queueMs: 80,
              reqMs: 800,
              status: 404,
              url: 'https://example.com/foo',
            },
          ],
        },
      });

      const [trace2Data, trace2Msg] = logger.logger.trace.mock.calls[1];
      expect(trace2Msg).toBe('HTTP URL statistics');
      expect(trace2Data).toEqual({
        urls: {
          'https://example.com/bar': {
            GET: {
              '200': 1,
            },
          },
          'https://example.com/foo': {
            GET: {
              '200': 2,
              '404': 1,
            },
          },
        },
      });

      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
      const [debugData, debugMsg] = logger.logger.debug.mock.calls[0];
      expect(debugMsg).toBe('HTTP statistics');
      expect(debugData).toEqual({
        hosts: {
          'example.com': {
            count: 4,
            queueAvgMs: 38,
            queueMaxMs: 80,
            queueMedianMs: 40,
            reqAvgMs: 375,
            reqMaxMs: 800,
            reqMedianMs: 400,
          },
        },
        requests: 4,
      });
    });
  });

  describe('HttpCacheStats', () => {
    it('returns empty data', () => {
      const res = HttpCacheStats.getData();
      expect(res).toEqual({});
    });

    it('ignores wrong url', () => {
      HttpCacheStats.incLocalHits('<invalid>');
      expect(HttpCacheStats.getData()).toEqual({});
    });

    it('writes data points', () => {
      HttpCacheStats.incLocalHits('https://example.com/foo');
      HttpCacheStats.incLocalHits('https://example.com/foo');
      HttpCacheStats.incLocalMisses('https://example.com/foo');
      HttpCacheStats.incLocalMisses('https://example.com/bar');
      HttpCacheStats.incRemoteHits('https://example.com/bar');
      HttpCacheStats.incRemoteMisses('https://example.com/bar');

      const res = HttpCacheStats.getData();

      expect(res).toEqual({
        'https://example.com/bar': {
          hit: 1,
          miss: 1,
          localMiss: 1,
        },
        'https://example.com/foo': {
          hit: 0,
          miss: 0,
          localHit: 2,
          localMiss: 1,
        },
      });
    });

    it('prints report', () => {
      HttpCacheStats.incLocalHits('https://example.com/foo');
      HttpCacheStats.incLocalHits('https://example.com/foo');
      HttpCacheStats.incLocalMisses('https://example.com/foo');
      HttpCacheStats.incLocalMisses('https://example.com/bar');
      HttpCacheStats.incRemoteHits('https://example.com/bar');
      HttpCacheStats.incRemoteMisses('https://example.com/bar');

      HttpCacheStats.report();

      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
      const [data, msg] = logger.logger.debug.mock.calls[0];
      expect(msg).toBe('HTTP cache statistics');
      expect(data).toEqual({
        'https://example.com': {
          '/foo': { hit: 0, localHit: 2, localMiss: 1, miss: 0 },
          '/bar': { hit: 1, localMiss: 1, miss: 1 },
        },
      });
    });
  });

  describe('AbandonmentStats', () => {
    beforeEach(() => {
      memCache.init();
    });

    it('returns empty report', () => {
      const res = AbandonedPackageStats.getReport();
      expect(res).toEqual({});
    });

    it('writes data points', () => {
      AbandonedPackageStats.write(
        'npm',
        'package1',
        '2023-01-01T00:00:00.000Z',
      );
      AbandonedPackageStats.write(
        'npm',
        'package2',
        '2023-02-01T00:00:00.000Z',
      );
      AbandonedPackageStats.write(
        'docker',
        'image1',
        '2023-03-01T00:00:00.000Z',
      );

      const data = AbandonedPackageStats.getData();
      expect(data).toEqual([
        {
          datasource: 'npm',
          packageName: 'package1',
          mostRecentTimestamp: '2023-01-01T00:00:00.000Z',
        },
        {
          datasource: 'npm',
          packageName: 'package2',
          mostRecentTimestamp: '2023-02-01T00:00:00.000Z',
        },
        {
          datasource: 'docker',
          packageName: 'image1',
          mostRecentTimestamp: '2023-03-01T00:00:00.000Z',
        },
      ]);

      const report = AbandonedPackageStats.getReport();
      expect(report).toEqual({
        npm: {
          package1: '2023-01-01T00:00:00.000Z',
          package2: '2023-02-01T00:00:00.000Z',
        },
        docker: {
          image1: '2023-03-01T00:00:00.000Z',
        },
      });
    });

    it('logs report', () => {
      AbandonedPackageStats.write(
        'npm',
        'package1',
        '2023-01-01T00:00:00.000Z',
      );
      AbandonedPackageStats.write(
        'docker',
        'image1',
        '2023-03-01T00:00:00.000Z',
      );

      AbandonedPackageStats.report();

      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
      const [data, msg] = logger.logger.debug.mock.calls[0];
      expect(msg).toBe('Abandoned package statistics');
      expect(data).toEqual({
        npm: {
          package1: '2023-01-01T00:00:00.000Z',
        },
        docker: {
          image1: '2023-03-01T00:00:00.000Z',
        },
      });
    });

    it('does not log report when no data', () => {
      AbandonedPackageStats.report();
      expect(logger.logger.debug).not.toHaveBeenCalled();
    });
  });
});
