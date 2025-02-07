'use strict';
process.env.NODE_TEST_KNOWN_GLOBALS = 0;
const common = require('../common');

const assert = require('node:assert');
const { it, mock, describe } = require('node:test');
const nodeTimers = require('node:timers');
const nodeTimersPromises = require('node:timers/promises');

describe('Mock Timers Test Suite', () => {
  describe('MockTimers API', () => {
    it('should throw an error if trying to enable a timer that is not supported', (t) => {
      assert.throws(() => {
        t.mock.timers.enable({ apis: ['DOES_NOT_EXIST'] });
      }, {
        code: 'ERR_INVALID_ARG_VALUE',
      });
    });

    it('should throw an error if trying to enable a timer twice', (t) => {
      t.mock.timers.enable();
      assert.throws(() => {
        t.mock.timers.enable();
      }, {
        code: 'ERR_INVALID_STATE',
      });
    });

    it('should not throw if calling reset without enabling timers', (t) => {
      t.mock.timers.reset();
    });

    it('should throw an error if calling tick without enabling timers', (t) => {
      assert.throws(() => {
        t.mock.timers.tick();
      }, {
        code: 'ERR_INVALID_STATE',
      });
    });

    it('should throw an error if calling tick with a negative number', (t) => {
      t.mock.timers.enable();
      assert.throws(() => {
        t.mock.timers.tick(-1);
      }, {
        code: 'ERR_INVALID_ARG_VALUE',
      });
    });

    it('should check that propertyDescriptor gets back after resetting timers', (t) => {
      const getDescriptor = (ctx, fn) => Object.getOwnPropertyDescriptor(ctx, fn);
      const getCurrentTimersDescriptors = () => {
        const timers = [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'clearImmediate',
        ];

        const globalTimersDescriptors = timers.map((fn) => getDescriptor(global, fn));
        const nodeTimersDescriptors = timers.map((fn) => getDescriptor(nodeTimers, fn));
        const nodeTimersPromisesDescriptors = timers
          .filter((fn) => !fn.includes('clear'))
          .map((fn) => getDescriptor(nodeTimersPromises, fn));

        return {
          global: globalTimersDescriptors,
          nodeTimers: nodeTimersDescriptors,
          nodeTimersPromises: nodeTimersPromisesDescriptors,
        };
      };

      const originalDescriptors = getCurrentTimersDescriptors();

      t.mock.timers.enable();
      const during = getCurrentTimersDescriptors();
      t.mock.timers.reset();
      const after = getCurrentTimersDescriptors();

      for (const env in originalDescriptors) {
        for (const prop in originalDescriptors[env]) {
          const originalDescriptor = originalDescriptors[env][prop];
          const afterDescriptor = after[env][prop];

          assert.deepStrictEqual(
            originalDescriptor,
            afterDescriptor,
          );

          assert.notDeepStrictEqual(
            originalDescriptor,
            during[env][prop],
          );

          assert.notDeepStrictEqual(
            during[env][prop],
            after[env][prop],
          );

        }
      }
    });

    it('should reset all timers when calling .reset function', (t) => {
      t.mock.timers.enable();
      const fn = t.mock.fn();
      global.setTimeout(fn, 1000);
      t.mock.timers.reset();
      assert.deepStrictEqual(Date.now, globalThis.Date.now);
      assert.throws(() => {
        t.mock.timers.tick(1000);
      }, {
        code: 'ERR_INVALID_STATE',
      });

      assert.strictEqual(fn.mock.callCount(), 0);
    });

    it('should reset all timers when calling Symbol.dispose', (t) => {
      t.mock.timers.enable();
      const fn = t.mock.fn();
      global.setTimeout(fn, 1000);
      // TODO(benjamingr) refactor to `using`
      t.mock.timers[Symbol.dispose]();
      assert.throws(() => {
        t.mock.timers.tick(1000);
      }, {
        code: 'ERR_INVALID_STATE',
      });

      assert.strictEqual(fn.mock.callCount(), 0);
    });

    it('should execute in order if timeout is the same', (t) => {
      t.mock.timers.enable();
      const order = [];
      const fn1 = t.mock.fn(() => order.push('f1'));
      const fn2 = t.mock.fn(() => order.push('f2'));
      global.setTimeout(fn1, 1000);
      global.setTimeout(fn2, 1000);
      t.mock.timers.tick(1000);
      assert.strictEqual(fn1.mock.callCount(), 1);
      assert.strictEqual(fn2.mock.callCount(), 1);
      assert.deepStrictEqual(order, ['f1', 'f2']);
    });

    describe('runAll Suite', () => {
      it('should throw an error if calling runAll without enabling timers', (t) => {
        assert.throws(() => {
          t.mock.timers.runAll();
        }, {
          code: 'ERR_INVALID_STATE',
        });
      });

      it('should trigger all timers when calling .runAll function', async (t) => {
        const timeoutFn = t.mock.fn();
        const intervalFn = t.mock.fn();

        t.mock.timers.enable();
        global.setTimeout(timeoutFn, 1111);
        const id = global.setInterval(intervalFn, 9999);
        t.mock.timers.runAll();

        global.clearInterval(id);
        assert.strictEqual(timeoutFn.mock.callCount(), 1);
        assert.strictEqual(intervalFn.mock.callCount(), 1);
      });

      it('should increase the epoch as the tick run for runAll', async (t) => {
        const timeoutFn = t.mock.fn();
        const intervalFn = t.mock.fn();

        t.mock.timers.enable();
        global.setTimeout(timeoutFn, 1111);
        const id = global.setInterval(intervalFn, 9999);
        t.mock.timers.runAll();

        global.clearInterval(id);
        assert.strictEqual(timeoutFn.mock.callCount(), 1);
        assert.strictEqual(intervalFn.mock.callCount(), 1);
        assert.strictEqual(Date.now(), 9999);
      });

      it('should not error if there are not timers to run', (t) => {
        t.mock.timers.enable();
        t.mock.timers.runAll();
        // Should not throw
      });
    });
  });

  describe('globals/timers', () => {
    describe('setTimeout Suite', () => {
      it('should advance in time and trigger timers when calling the .tick function', (t) => {
        mock.timers.enable({ apis: ['setTimeout'] });

        const fn = mock.fn();

        global.setTimeout(fn, 4000);

        mock.timers.tick(4000);
        assert.strictEqual(fn.mock.callCount(), 1);
        mock.timers.reset();
      });

      it('should advance in time and trigger timers when calling the .tick function multiple times', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const fn = t.mock.fn();

        global.setTimeout(fn, 2000);

        t.mock.timers.tick(1000);
        assert.strictEqual(fn.mock.callCount(), 0);
        t.mock.timers.tick(500);
        assert.strictEqual(fn.mock.callCount(), 0);
        t.mock.timers.tick(500);
        assert.strictEqual(fn.mock.callCount(), 1);
      });

      it('should work with the same params as the original setTimeout', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const fn = t.mock.fn();
        const args = ['a', 'b', 'c'];
        global.setTimeout(fn, 2000, ...args);

        t.mock.timers.tick(1000);
        t.mock.timers.tick(500);
        t.mock.timers.tick(500);

        assert.strictEqual(fn.mock.callCount(), 1);
        assert.deepStrictEqual(fn.mock.calls[0].arguments, args);
      });

      it('should keep setTimeout working if timers are disabled', (t, done) => {
        const now = Date.now();
        const timeout = 2;
        const expected = () => now - timeout;
        global.setTimeout(common.mustCall(() => {
          assert.strictEqual(now - timeout, expected());
          done();
        }), timeout);
      });
    });

    describe('clearTimeout Suite', () => {
      it('should not advance in time if clearTimeout was invoked', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });

        const fn = mock.fn();

        const id = global.setTimeout(fn, 4000);
        global.clearTimeout(id);
        t.mock.timers.tick(4000);

        assert.strictEqual(fn.mock.callCount(), 0);
      });
    });

    describe('setInterval Suite', () => {
      it('should tick three times using fake setInterval', (t) => {
        t.mock.timers.enable({ apis: ['setInterval'] });
        const fn = t.mock.fn();

        const id = global.setInterval(fn, 200);

        t.mock.timers.tick(200);
        t.mock.timers.tick(200);
        t.mock.timers.tick(200);

        global.clearInterval(id);

        assert.strictEqual(fn.mock.callCount(), 3);
      });

      it('should work with the same params as the original setInterval', (t) => {
        t.mock.timers.enable({ apis: ['setInterval'] });
        const fn = t.mock.fn();
        const args = ['a', 'b', 'c'];
        const id = global.setInterval(fn, 200, ...args);

        t.mock.timers.tick(200);
        t.mock.timers.tick(200);
        t.mock.timers.tick(200);

        global.clearInterval(id);

        assert.strictEqual(fn.mock.callCount(), 3);
        assert.deepStrictEqual(fn.mock.calls[0].arguments, args);
        assert.deepStrictEqual(fn.mock.calls[1].arguments, args);
        assert.deepStrictEqual(fn.mock.calls[2].arguments, args);
      });
    });

    describe('clearInterval Suite', () => {
      it('should not advance in time if clearInterval was invoked', (t) => {
        t.mock.timers.enable({ apis: ['setInterval'] });

        const fn = mock.fn();
        const id = global.setInterval(fn, 200);
        global.clearInterval(id);
        t.mock.timers.tick(200);

        assert.strictEqual(fn.mock.callCount(), 0);
      });
    });

    describe('setImmediate Suite', () => {
      it('should keep setImmediate working if timers are disabled', (t, done) => {
        const now = Date.now();
        const timeout = 2;
        const expected = () => now - timeout;
        global.setImmediate(common.mustCall(() => {
          assert.strictEqual(now - timeout, expected());
          done();
        }));
      });

      it('should work with the same params as the original setImmediate', (t) => {
        t.mock.timers.enable({ apis: ['setImmediate'] });
        const fn = t.mock.fn();
        const args = ['a', 'b', 'c'];
        global.setImmediate(fn, ...args);
        t.mock.timers.tick(9999);

        assert.strictEqual(fn.mock.callCount(), 1);
        assert.deepStrictEqual(fn.mock.calls[0].arguments, args);
      });

      it('should not advance in time if clearImmediate was invoked', (t) => {
        t.mock.timers.enable({ apis: ['setImmediate'] });

        const id = global.setImmediate(common.mustNotCall());
        global.clearImmediate(id);
        t.mock.timers.tick(200);
      });

      it('should advance in time and trigger timers when calling the .tick function', (t) => {
        t.mock.timers.enable({ apis: ['setImmediate'] });
        global.setImmediate(common.mustCall(1));
        t.mock.timers.tick(0);
      });

      it('should execute in order if setImmediate is called multiple times', (t) => {
        t.mock.timers.enable({ apis: ['setImmediate'] });
        const order = [];
        const fn1 = t.mock.fn(common.mustCall(() => order.push('f1'), 1));
        const fn2 = t.mock.fn(common.mustCall(() => order.push('f2'), 1));

        global.setImmediate(fn1);
        global.setImmediate(fn2);

        t.mock.timers.tick(0);

        assert.deepStrictEqual(order, ['f1', 'f2']);
      });

      it('should execute setImmediate first if setTimeout was also called', (t) => {
        t.mock.timers.enable({ apis: ['setImmediate', 'setTimeout'] });
        const order = [];
        const fn1 = t.mock.fn(common.mustCall(() => order.push('f1'), 1));
        const fn2 = t.mock.fn(common.mustCall(() => order.push('f2'), 1));

        global.setTimeout(fn2, 0);
        global.setImmediate(fn1);

        t.mock.timers.tick(100);

        assert.deepStrictEqual(order, ['f1', 'f2']);
      });
    });

    describe('timers/promises', () => {
      describe('setTimeout Suite', () => {
        it('should advance in time and trigger timers when calling the .tick function multiple times', async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });

          const p = nodeTimersPromises.setTimeout(2000);

          t.mock.timers.tick(1000);
          t.mock.timers.tick(500);
          t.mock.timers.tick(500);
          t.mock.timers.tick(500);

          p.then(common.mustCall((result) => {
            assert.strictEqual(result, undefined);
          }));
        });

        it('should work with the same params as the original timers/promises/setTimeout', async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          const expectedResult = 'result';
          const controller = new AbortController();
          const p = nodeTimersPromises.setTimeout(2000, expectedResult, {
            ref: true,
            signal: controller.signal,
          });

          t.mock.timers.tick(1000);
          t.mock.timers.tick(500);
          t.mock.timers.tick(500);
          t.mock.timers.tick(500);

          const result = await p;
          assert.strictEqual(result, expectedResult);
        });

        it('should abort operation if timers/promises/setTimeout received an aborted signal', async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          const expectedResult = 'result';
          const controller = new AbortController();
          const p = nodeTimersPromises.setTimeout(2000, expectedResult, {
            ref: true,
            signal: controller.signal,
          });

          t.mock.timers.tick(1000);
          controller.abort();
          t.mock.timers.tick(500);
          t.mock.timers.tick(500);
          t.mock.timers.tick(500);
          await assert.rejects(() => p, {
            name: 'AbortError',
          });
        });
        it('should abort operation even if the .tick was not called', async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          const expectedResult = 'result';
          const controller = new AbortController();
          const p = nodeTimersPromises.setTimeout(2000, expectedResult, {
            ref: true,
            signal: controller.signal,
          });

          controller.abort();

          await assert.rejects(() => p, {
            name: 'AbortError',
          });
        });

        it('should abort operation when .abort is called before calling setInterval', async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          const expectedResult = 'result';
          const controller = new AbortController();
          controller.abort();
          const p = nodeTimersPromises.setTimeout(2000, expectedResult, {
            ref: true,
            signal: controller.signal,
          });

          await assert.rejects(() => p, {
            name: 'AbortError',
          });
        });

        it('should reject given an an invalid signal instance', async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          const expectedResult = 'result';
          const p = nodeTimersPromises.setTimeout(2000, expectedResult, {
            ref: true,
            signal: {},
          });

          await assert.rejects(() => p, {
            name: 'TypeError',
            code: 'ERR_INVALID_ARG_TYPE',
          });
        });
      });

      describe('setInterval Suite', () => {
        it('should tick three times using fake setInterval', async (t) => {
          t.mock.timers.enable({ apis: ['setInterval'] });

          const interval = 100;
          const intervalIterator = nodeTimersPromises.setInterval(interval, Date.now());

          const first = intervalIterator.next();
          const second = intervalIterator.next();
          const third = intervalIterator.next();

          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);

          const results = await Promise.all([
            first,
            second,
            third,
          ]);

          const finished = await intervalIterator.return();
          assert.deepStrictEqual(finished, { done: true, value: undefined });
          results.forEach((result) => {
            assert.strictEqual(typeof result.value, 'number');
            assert.strictEqual(result.done, false);
          });
        });
        it('should tick five times testing a real use case', async (t) => {
          t.mock.timers.enable({ apis: ['setInterval'] });

          const expectedIterations = 5;
          const interval = 1000;
          const startedAt = Date.now();
          async function run() {
            const times = [];
            for await (const time of nodeTimersPromises.setInterval(interval, startedAt)) {
              times.push(time);
              if (times.length === expectedIterations) break;
            }
            return times;
          }

          const r = run();
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);

          const timeResults = await r;
          assert.strictEqual(timeResults.length, expectedIterations);
          for (let it = 1; it < expectedIterations; it++) {
            assert.strictEqual(timeResults[it - 1], startedAt + (interval * it));
          }
        });

        it('should abort operation given an abort controller signal', async (t) => {
          t.mock.timers.enable({ apis: ['setInterval'] });

          const interval = 100;
          const abortController = new AbortController();
          const intervalIterator = nodeTimersPromises.setInterval(interval, Date.now(), {
            signal: abortController.signal,
          });

          const first = intervalIterator.next();
          const second = intervalIterator.next();

          t.mock.timers.tick(interval);
          abortController.abort();
          t.mock.timers.tick(interval);

          const firstResult = await first;
          // Interval * 2 because value can be a little bit greater than interval
          assert.ok(firstResult.value < Date.now() + interval * 2);
          assert.strictEqual(firstResult.done, false);

          await assert.rejects(() => second, {
            name: 'AbortError',
          });
        });

        it('should abort operation when .abort is called before calling setInterval', async (t) => {
          t.mock.timers.enable({ apis: ['setInterval'] });

          const interval = 100;
          const abortController = new AbortController();
          abortController.abort();
          const intervalIterator = nodeTimersPromises.setInterval(interval, Date.now(), {
            signal: abortController.signal,
          });

          const first = intervalIterator.next();
          t.mock.timers.tick(interval);

          await assert.rejects(() => first, {
            name: 'AbortError',
          });
        });

        it('should abort operation given an abort controller signal on a real use case', async (t) => {
          t.mock.timers.enable({ apis: ['setInterval'] });
          const controller = new AbortController();
          const signal = controller.signal;
          const interval = 200;
          const expectedIterations = 2;
          const startedAt = Date.now();
          const timeResults = [];
          async function run() {
            const it = nodeTimersPromises.setInterval(interval, startedAt, { signal });
            for await (const time of it) {
              timeResults.push(time);
              if (timeResults.length === 5) break;
            }
          }

          const r = run();
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          controller.abort();
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);
          t.mock.timers.tick(interval);

          await assert.rejects(() => r, {
            name: 'AbortError',
          });
          assert.strictEqual(timeResults.length, expectedIterations);

          for (let it = 1; it < expectedIterations; it++) {
            assert.strictEqual(timeResults[it - 1], startedAt + (interval * it));
          }
        });
      });
    });
  });

  describe('Date Suite', () => {
    it('should return the initial UNIX epoch if not specified', (t) => {
      t.mock.timers.enable({ apis: ['Date'] });
      const date = new Date();
      assert.strictEqual(date.getTime(), 0);
      assert.strictEqual(Date.now(), 0);
    });

    it('should throw an error if setTime is called without enabling timers', (t) => {
      assert.throws(
        () => {
          t.mock.timers.setTime(100);
        },
        { code: 'ERR_INVALID_STATE' }
      );
    });

    it('should throw an error if epoch passed to enable is not valid', (t) => {
      assert.throws(
        () => {
          t.mock.timers.enable({ now: -1 });
        },
        { code: 'ERR_INVALID_ARG_VALUE' }
      );

      assert.throws(
        () => {
          t.mock.timers.enable({ now: 'string' });
        },
        { code: 'ERR_INVALID_ARG_TYPE' }
      );

      assert.throws(
        () => {
          t.mock.timers.enable({ now: NaN });
        },
        { code: 'ERR_INVALID_ARG_VALUE' }
      );
    });

    it('should replace the original Date with the mocked one', (t) => {
      t.mock.timers.enable({ apis: ['Date'] });
      assert.ok(Date.isMock);
    });

    it('should return the ticked time when calling Date.now after tick', (t) => {
      t.mock.timers.enable({ apis: ['Date'] });
      const time = 100;
      t.mock.timers.tick(time);
      assert.strictEqual(Date.now(), time);
    });

    it('should return the Date as string when calling it as a function', (t) => {
      t.mock.timers.enable({ apis: ['Date'] });
      const returned = Date();
      // Matches the format: 'Mon Jan 01 1970 00:00:00'
      // We don't care about the date, just the format
      assert.ok(/\w{3}\s\w{3}\s\d{1,2}\s\d{2,4}\s\d{1,2}:\d{2}:\d{2}/.test(returned));
    });

    it('should return the date with different argument calls', (t) => {
      t.mock.timers.enable({ apis: ['Date'] });
      assert.strictEqual(new Date(0).getTime(), 0);
      assert.strictEqual(new Date(100).getTime(), 100);
      assert.strictEqual(new Date('1970-01-01T00:00:00.000Z').getTime(), 0);
      assert.strictEqual(new Date(1970, 0).getFullYear(), 1970);
      assert.strictEqual(new Date(1970, 0).getMonth(), 0);
      assert.strictEqual(new Date(1970, 0, 1).getDate(), 1);
      assert.strictEqual(new Date(1970, 0, 1, 11).getHours(), 11);
      assert.strictEqual(new Date(1970, 0, 1, 11, 10).getMinutes(), 10);
      assert.strictEqual(new Date(1970, 0, 1, 11, 10, 45).getSeconds(), 45);
      assert.strictEqual(new Date(1970, 0, 1, 11, 10, 45, 898).getMilliseconds(), 898);
      assert.strictEqual(new Date(1970, 0, 1, 11, 10, 45, 898).toDateString(), 'Thu Jan 01 1970');
    });

    it('should return native code when calling Date.toString', (t) => {
      t.mock.timers.enable({ apis: ['Date'] });
      assert.strictEqual(Date.toString(), 'function Date() { [native code] }');
    });

    it('should start with a custom epoch if the second argument is specified', (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: 100 });
      const date1 = new Date();
      assert.strictEqual(date1.getTime(), 100);

      t.mock.timers.reset();
      t.mock.timers.enable({ apis: ['Date'], now: new Date(200) });
      const date2 = new Date();
      assert.strictEqual(date2.getTime(), 200);
    });

    it('should replace epoch if setTime is lesser than now and not tick', (t) => {
      t.mock.timers.enable();
      const fn = t.mock.fn();
      const id = setTimeout(fn, 1000);
      t.mock.timers.setTime(800);
      assert.strictEqual(Date.now(), 800);
      t.mock.timers.setTime(500);
      assert.strictEqual(Date.now(), 500);
      assert.strictEqual(fn.mock.callCount(), 0);
      clearTimeout(id);
    });

    it('should not tick time when setTime is called', (t) => {
      t.mock.timers.enable();
      const fn = t.mock.fn();
      const id = setTimeout(fn, 1000);
      t.mock.timers.setTime(1200);
      assert.strictEqual(Date.now(), 1200);
      assert.strictEqual(fn.mock.callCount(), 0);
      clearTimeout(id);
    });
  });
});
