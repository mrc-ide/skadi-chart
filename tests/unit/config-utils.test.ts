import { deepAssignRecordIfDefined } from "@/Chart/config/utils";
import { DeepPartialRecord } from "@/types";

describe("config utils", () => {
  describe("deepAssignRecordIfDefined", () => {
    test("assigns shallow defined values and skips undefined", () => {
      const target = { a: 1, b: "keep" };
      const patch: DeepPartialRecord<typeof target> = { a: 9, b: undefined };

      deepAssignRecordIfDefined(target, patch);

      expect(target).toStrictEqual({ a: 9, b: "keep" });
    });

    test("deep merges nested plain objects", () => {
      const target = {
        title: "chart",
        axis: {
          x: { min: 0, max: 10 },
          y: { min: 1, max: 20 },
        },
      };

      const patch: DeepPartialRecord<typeof target> = {
        axis: {
          x: { min: 2 },
        },
      };

      deepAssignRecordIfDefined(target, patch);

      expect(target).toStrictEqual({
        title: "chart",
        axis: {
          x: { min: 2, max: 10 },
          y: { min: 1, max: 20 },
        },
      });
    });

    test("does not deep merge arrays", () => {
      const target = {
        points: [1, 2, 3],
        nested: { points: [4, 5] },
      };

      const patch: DeepPartialRecord<typeof target> = {
        points: [10],
        nested: { points: [99] },
      };

      deepAssignRecordIfDefined(target, patch);

      expect(target).toStrictEqual({
        points: [10],
        nested: { points: [99] },
      });
    });

    test("does not deep merge non-plain objects", () => {
      const target = {
        date: new Date("2020-01-01T00:00:00.000Z"),
        map: new Map([["a", 1]]),
      };

      const patch: DeepPartialRecord<typeof target> = {
        date: new Date("2021-01-01T00:00:00.000Z"),
        map: new Map([["b", 2]]),
      };

      deepAssignRecordIfDefined(target, patch);

      expect(target.date.toISOString()).toBe("2021-01-01T00:00:00.000Z");
      expect(Array.from(target.map.entries())).toStrictEqual([["b", 2]]);
    });

    test("deep merges null-prototype dictionaries", () => {
      const base = Object.create(null) as Record<string, unknown>;
      base.a = 1;

      const patch = Object.create(null) as Record<string, unknown>;
      patch.b = 2;

      const target: Record<string, unknown> = {
        nested: base,
      };

      deepAssignRecordIfDefined(target, {
        nested: patch,
      });

      expect((target.nested as Record<string, unknown>).a).toBe(1);
      expect((target.nested as Record<string, unknown>).b).toBe(2);
      expect(Object.getPrototypeOf(target.nested)).toBe(null);
    });
  });
});
